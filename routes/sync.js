const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { dbGet, dbRun, dbAll, dbTransaction } = require('../models/db');

const ALLOWED_COLLECTIONS = [
  'goals', 'diary', 'notes', 'journals', 'habits', 'habitLog',
  'gymLog', 'gymTemplates', 'bodyLog', 'archived', 'chatConversations',
  'chatMemories', 'aiSettings', 'schede', 'profile', 'habitReminder',
];

router.get('/', authenticate, (req, res) => {
  try {
    const rows = dbAll('SELECT collection, data, version, updated_at FROM sync_data WHERE user_id = ?', [req.userId]);

    const result = {};
    for (const row of rows) {
      try {
        result[row.collection] = JSON.parse(row.data);
      } catch {
        result[row.collection] = null;
      }
    }

    res.json({ data: result, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/', authenticate, (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data richiesto (oggetto chiave->valore)' });
    }

    dbTransaction(() => {
      for (const [collection, value] of Object.entries(data)) {
        if (!ALLOWED_COLLECTIONS.includes(collection)) continue;

        const existing = dbGet(
          'SELECT id FROM sync_data WHERE user_id = ? AND collection = ?',
          [req.userId, collection]
        );

        const jsonData = JSON.stringify(value);

        if (existing) {
          dbRun(
            'UPDATE sync_data SET data = ?, version = version + 1, updated_at = datetime(\'now\') WHERE user_id = ? AND collection = ?',
            [jsonData, req.userId, collection]
          );
        } else {
          dbRun(
            'INSERT INTO sync_data (user_id, collection, data, version, updated_at) VALUES (?, ?, ?, 1, datetime(\'now\'))',
            [req.userId, collection, jsonData]
          );
        }
      }
    });

    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:collection', authenticate, (req, res) => {
  try {
    const { collection } = req.params;
    if (!ALLOWED_COLLECTIONS.includes(collection)) {
      return res.status(400).json({ error: 'Collezione non valida' });
    }

    dbRun('DELETE FROM sync_data WHERE user_id = ? AND collection = ?', [req.userId, collection]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
