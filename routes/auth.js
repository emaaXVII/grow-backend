const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbRun, dbAll } = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'grow-jwt-secret';

router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password richieste' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri' });
    }

    const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email già registrata' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    dbRun('INSERT INTO users (id, email, password_hash, nickname) VALUES (?, ?, ?, ?)', [
      id, email, passwordHash, nickname || '',
    ]);

    dbRun('INSERT INTO subscriptions (id, user_id, plan, status) VALUES (?, ?, ?, ?)', [
      uuidv4(), id, 'free', 'active',
    ]);

    const token = jwt.sign({ userId: id, email }, JWT_SECRET, { expiresIn: '90d' });

    res.status(201).json({
      token,
      user: { id, email, nickname: nickname || '', plan: 'free' },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password richieste' });
    }

    const user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const sub = dbGet('SELECT plan FROM subscriptions WHERE user_id = ?', [user.id]);

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '90d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname || '',
        plan: sub?.plan || 'free',
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', require('../middleware/auth').authenticate, (req, res) => {
  const user = dbGet('SELECT id, email, nickname, created_at FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });

  const sub = dbGet('SELECT plan, status, expires_at FROM subscriptions WHERE user_id = ?', [req.userId]);

  res.json({
    user: { ...user, plan: sub?.plan || 'free', subscription: sub },
  });
});

module.exports = router;
