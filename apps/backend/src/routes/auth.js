import { Router } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../../db/logger.js';
import { config } from '../config.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username !== config.auth.adminUser || password !== config.auth.adminPass) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username, role: 'admin' }, config.auth.jwtSecret, { expiresIn: '24h' });
  logger.info({ username }, 'Login successful');
  res.json({ token, user: { username, role: 'admin' } });
});

export default router;
