const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDB } = require('../models/db');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function groqFetch(bodyObj, timeoutMs = 30000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') {
      throw new Error('La richiesta a Groq ha impiegato troppo tempo');
    }
    throw new Error('Errore di rete: ' + e.message);
  }
}

router.post('/chat', authenticate, async (req, res) => {
  try {
    const { messages, temperature = 0.7, maxTokens = 1800 } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages richiesto' });
    }

    const db = getDB();
    const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(req.userId);
    const isPremium = sub && sub.plan === 'premium';
    const maxMessages = isPremium ? 9999 : 50;

    if (messages.length > maxMessages) {
      return res.status(400).json({
        error: `Limite messaggi per sessione: ${maxMessages}. ${isPremium ? '' : 'Passa a Premium per illimitato.'}`,
      });
    }

    let model = GROQ_MODEL;
    let effectiveMaxTokens = maxTokens;
    if (isPremium) {
      model = 'llama-3.1-70b-versatile';
      effectiveMaxTokens = Math.min(maxTokens, 4000);
    }

    const groqRes = await groqFetch({
      model,
      messages,
      temperature,
      max_tokens: effectiveMaxTokens,
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      if (groqRes.status === 429) {
        return res.status(429).json({ error: 'Groq è momentaneamente occupata. Riprova tra qualche secondo.' });
      }
      return res.status(groqRes.status).json({
        error: errBody?.error?.message || `Errore Groq: ${groqRes.status}`,
      });
    }

    const data = await groqRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/generate', authenticate, async (req, res) => {
  try {
    const { prompt, temperature = 0.7, maxTokens = 2000, responseFormat } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt richiesto' });
    }

    const body = {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    };
    if (responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const groqRes = await groqFetch(body);

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({
        error: errBody?.error?.message || `Errore Groq: ${groqRes.status}`,
      });
    }

    const data = await groqRes.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    res.json({ content: cleaned });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/chat-raw', authenticate, async (req, res) => {
  try {
    const { messages, tools, temperature = 0.7, maxTokens = 1800 } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages richiesto' });
    }

    const body = { model: GROQ_MODEL, messages, temperature, max_tokens: maxTokens };
    if (tools && tools.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const groqRes = await groqFetch(body, 45000);

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({
        error: errBody?.error?.message || `Errore Groq: ${groqRes.status}`,
      });
    }

    const data = await groqRes.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
