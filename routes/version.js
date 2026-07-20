const express = require('express');
const router = express.Router();
const { dbGet, dbRun, dbAll } = require('../models/db');

router.get('/', (req, res) => {
  try {
    const latest = dbGet('SELECT * FROM version_check ORDER BY build DESC LIMIT 1');

    if (!latest) {
      return res.json({
        currentVersion: process.env.APP_VERSION || '1.0.0',
        currentBuild: parseInt(process.env.APP_BUILD || '1'),
        updateAvailable: false,
      });
    }

    const currentBuild = parseInt(req.query.build || '0');

    res.json({
      latestVersion: latest.version,
      latestBuild: latest.build,
      updateAvailable: latest.build > currentBuild,
      forceUpdate: !!latest.force_update,
      updateUrl: latest.update_url,
      notes: latest.notes,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/register', (req, res) => {
  try {
    const { version, build, updateUrl, notes, forceUpdate } = req.body;
    if (!version || !build) {
      return res.status(400).json({ error: 'version e build richiesti' });
    }

    dbRun(
      'INSERT INTO version_check (version, build, update_url, notes, force_update) VALUES (?, ?, ?, ?, ?)',
      [version, build, updateUrl || '', notes || '', forceUpdate ? 1 : 0]
    );

    res.status(201).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
