require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./models/db');

const aiRoutes = require('./routes/ai');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const subscriptionRoutes = require('./routes/subscription');
const versionRoutes = require('./routes/version');

const app = express();
const PORT = process.env.PORT || 3001;

initDB();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/version', versionRoutes);

app.get('/', (req, res) => {
  res.json({ app: 'GROW Backend', status: 'running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Errore interno del server' });
});

app.listen(PORT, () => {
  console.log(`GROW Backend in ascolto sulla porta ${PORT}`);
});
