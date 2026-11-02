import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  if (!config.auth.apiKey) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== config.auth.apiKey) {
    return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
  }
  next();
}

export function requireJWT(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
