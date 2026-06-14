import { Router } from 'express';
import { getDatabase, DB_TYPE } from '../../db/database.js';

const router = Router();

router.get('/covers/random', async (req, res) => {
  try {
    const db = getDatabase();
    const order = 'RANDOM()';
    const consoleId = req.query.console_id ? parseInt(req.query.console_id, 10) : null;

    let sql;
    let params;

    if (consoleId) {
      const placeholder = DB_TYPE === 'sqlite' ? '?' : '$1';
      sql = `SELECT cover_url FROM game_catalog gc JOIN consoles c ON gc.console_name = c.name WHERE c.id = ${placeholder} AND cover_url IS NOT NULL AND cover_url != '' ORDER BY ${order} LIMIT 30`;
      params = [consoleId];
    } else {
      sql = `SELECT cover_url FROM game_catalog WHERE cover_url IS NOT NULL AND cover_url != '' ORDER BY ${order} LIMIT 30`;
      params = [];
    }

    const result = await db.query(sql, params);
    const covers = result.rows.map(r => r.cover_url);
    res.json({ covers });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching covers' });
  }
});

export default router;
