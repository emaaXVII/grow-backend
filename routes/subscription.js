const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { dbGet, dbRun } = require('../models/db');

router.get(['/', '/status'], authenticate, (req, res) => {
  try {
    const sub = dbGet('SELECT * FROM subscriptions WHERE user_id = ?', [req.userId]);

    if (!sub) {
      return res.json({ plan: 'free', status: 'active', features: getFeatures('free') });
    }

    res.json({
      id: sub.id,
      plan: sub.plan,
      status: sub.status,
      expiresAt: sub.expires_at,
      features: getFeatures(sub.plan),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan || !['premium', 'lifetime'].includes(plan)) {
      return res.status(400).json({ error: 'Piano non valido. Scegli premium o lifetime.' });
    }

    const existing = dbGet('SELECT * FROM subscriptions WHERE user_id = ?', [req.userId]);

    if (existing) {
      dbRun(
        'UPDATE subscriptions SET plan = ?, status = ?, updated_at = datetime(\'now\') WHERE user_id = ?',
        [plan, 'active', req.userId]
      );
    } else {
      dbRun(
        'INSERT INTO subscriptions (id, user_id, plan, status) VALUES (?, ?, ?, ?)',
        [uuidv4(), req.userId, plan, 'active']
      );
    }

    res.json({ success: true, plan, features: getFeatures(plan) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/cancel', authenticate, (req, res) => {
  try {
    dbRun(
      'UPDATE subscriptions SET plan = \'free\', status = \'cancelled\', updated_at = datetime(\'now\') WHERE user_id = ?',
      [req.userId]
    );

    res.json({ success: true, plan: 'free' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function getFeatures(plan) {
  const base = {
    aiChat: true,
    aiPlan: true,
    weeklyCheckin: true,
    dailyMotivation: true,
    cloudSync: false,
    exportData: true,
    maxGoals: 3,
    maxHabits: 5,
    maxChatMessages: 50,
    ads: false,
  };

  if (plan === 'premium' || plan === 'lifetime') {
    return {
      ...base,
      cloudSync: true,
      maxGoals: 999,
      maxHabits: 999,
      maxChatMessages: 99999,
    };
  }

  return base;
}

module.exports = router;
