import { Router } from 'express';
import { getDatabase, DB_TYPE } from '../../db/database.js';

const router = Router();

router.get('/covers/random', async (_req, res) => {
  try {
    const db = getDatabase();
    const order = DB_TYPE === 'sqlite' ? 'RANDOM()' : 'RANDOM()';
    const result = await db.query(
      `SELECT cover_url FROM game_catalog WHERE cover_url IS NOT NULL AND cover_url != '' ORDER BY ${order} LIMIT 30`
    );
    const covers = result.rows.map(r => r.cover_url);
    res.json({ covers });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching covers' });
  }
});

export default router;
