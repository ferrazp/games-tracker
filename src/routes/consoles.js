import { Router } from 'express';
import { getDatabase, DB_TYPE } from '../../db/database.js';
import logger from '../../db/logger.js';
import { requireJWT } from '../middleware/auth.js';

const router = Router();

router.get('/consoles', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT id, name, launch_year, image, image_type FROM consoles ORDER BY name ASC');
    res.json({ consoles: result.rows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching consoles');
    res.status(500).json({ error: 'Error fetching consoles' });
  }
});

router.post('/consoles', requireJWT, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Console name is required' });
    }

    const db = getDatabase();
    const insertSQL = DB_TYPE === 'sqlite'
      ? 'INSERT INTO consoles (name) VALUES (?)'
      : 'INSERT INTO consoles (name) VALUES ($1) RETURNING *';

    try {
      const result = await db.query(insertSQL, [name.trim()]);
      const consoleObj = DB_TYPE === 'sqlite'
        ? { id: result.lastID, name: name.trim() }
        : result.rows[0];
      res.status(201).json({
        message: 'Console added successfully',
        console: consoleObj,
        success: true
      });
    } catch (error) {
      if (DB_TYPE === 'sqlite' && error.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Console already exists' });
      } else if (DB_TYPE === 'postgresql' && error.code === '23505') {
        return res.status(400).json({ error: 'Console already exists' });
      }
      throw error;
    }
  } catch (error) {
    logger.error({ err: error }, 'Error adding console');
    res.status(500).json({ error: 'Error adding console' });
  }
});

export default router;
