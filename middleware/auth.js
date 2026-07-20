const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'grow-jwt-secret';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token non fornito' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

module.exports = { authenticate };
