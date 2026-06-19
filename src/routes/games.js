import { Router } from 'express';
import { getDatabase, DB_TYPE } from '../../db/database.js';
import logger from '../../db/logger.js';
import { requireJWT } from '../middleware/auth.js';
import { validateGameData, parseGameData } from '../validators/game.js';

const router = Router();

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function fetchGameById(db, id) {
  if (DB_TYPE === 'sqlite') {
    const result = await db.query(
      `SELECT g.id, g.title, g.year_played, g.month_played, g.year_completed, g.month_completed, g.hours_played, g.completed, g.image, c.name as console_name, c.id as console_id, g.created_at, g.updated_at, g.release_year
       FROM games g
       LEFT JOIN consoles c ON g.console_id = c.id
       WHERE g.id = ?`,
      [id]
    );
    return result.rows[0] || null;
  }
  const result = await db.query('SELECT * FROM games_view WHERE id = $1', [id]);
  return result.rows[0] || null;
}

const ALLOWED_SORT_FIELDS = ['title', 'year_played', 'year_completed', 'created_at', 'updated_at', 'hours_played', 'release_year'];

router.get('/games', async (req, res) => {
  try {
    const db = getDatabase();
    const isSQLite = DB_TYPE === 'sqlite';
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const conditions = [];
    const params = [];

    function pushParam(val) {
      params.push(val);
      return isSQLite ? '?' : `$${params.length}`;
    }

    if (req.query.console_id) {
      const ci = parseInt(req.query.console_id);
      if (!isNaN(ci)) {
        conditions.push(`g.console_id = ${pushParam(ci)}`);
      }
    }

    if (req.query.completed !== undefined && req.query.completed !== '') {
      const val = req.query.completed === 'true' || req.query.completed === '1';
      conditions.push(`g.completed = ${pushParam(isSQLite ? (val ? 1 : 0) : val)}`);
    }

    if (req.query.q) {
      const likeOp = isSQLite ? 'LIKE' : 'ILIKE';
      conditions.push(`g.title ${likeOp} ${pushParam(`%${req.query.q}%`)}`);
    }

    if (req.query.year_played) {
      const yp = parseInt(req.query.year_played);
      if (!isNaN(yp)) {
        conditions.push(`g.year_played = ${pushParam(yp)}`);
      }
    } else {
      if (req.query.year_played_from) {
        const ypf = parseInt(req.query.year_played_from);
        if (!isNaN(ypf)) {
          conditions.push(`g.year_played >= ${pushParam(ypf)}`);
        }
      }
      if (req.query.year_played_to) {
        const ypt = parseInt(req.query.year_played_to);
        if (!isNaN(ypt)) {
          conditions.push(`g.year_played <= ${pushParam(ypt)}`);
        }
      }
    }

    if (req.query.year_completed) {
      const yc = parseInt(req.query.year_completed);
      if (!isNaN(yc)) {
        conditions.push(`g.year_completed = ${pushParam(yc)}`);
      }
    } else {
      if (req.query.year_completed_from) {
        const ycf = parseInt(req.query.year_completed_from);
        if (!isNaN(ycf)) {
          conditions.push(`g.year_completed >= ${pushParam(ycf)}`);
        }
      }
      if (req.query.year_completed_to) {
        const yct = parseInt(req.query.year_completed_to);
        if (!isNaN(yct)) {
          conditions.push(`g.year_completed <= ${pushParam(yct)}`);
        }
      }
    }

    const sortBy = ALLOWED_SORT_FIELDS.includes(req.query.sort_by) ? req.query.sort_by : 'created_at';
    const sortOrder = req.query.sort_order === 'asc' ? 'ASC' : 'DESC';
    const orderClause = isSQLite
      ? `ORDER BY g.${sortBy} ${sortOrder}`
      : `ORDER BY g.${sortBy} ${sortOrder} NULLS LAST`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const selectSQL = `
      SELECT g.id, g.title, g.year_played, g.month_played, g.year_completed, g.month_completed, g.hours_played, g.completed, g.image, g.release_year,
             c.name as console_name, c.id as console_id,
             g.created_at, g.updated_at
      FROM games g
      LEFT JOIN consoles c ON g.console_id = c.id
      ${whereClause}
      ${orderClause}
      LIMIT ${pushParam(limit)} OFFSET ${pushParam(offset)}
    `;

    const countSQL = `SELECT COUNT(*)${isSQLite ? '' : '::int'} as total FROM games g ${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(selectSQL, params),
      db.query(countSQL, params.slice(0, -2))
    ]);

    res.json({
      games: dataResult.rows,
      total: countResult.rows[0].total,
      limit,
      offset
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching games');
    res.status(500).json({ error: 'Error fetching games' });
  }
});

router.get('/games/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid game id' });

    const db = getDatabase();
    const game = await fetchGameById(db, id);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({ game });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching game');
    res.status(500).json({ error: 'Error fetching game' });
  }
});

router.post('/games', requireJWT, async (req, res) => {
  try {
    const db = getDatabase();

    const validation = validateGameData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const data = parseGameData(req.body);

    if (data.console_id) {
      const consoleQuery = DB_TYPE === 'sqlite'
        ? 'SELECT launch_year FROM consoles WHERE id = ?'
        : 'SELECT launch_year FROM consoles WHERE id = $1';
      const consoleResult = await db.query(consoleQuery, [data.console_id]);
      if (consoleResult.rows.length === 0) {
        return res.status(400).json({ error: 'Console does not exist' });
      }
      const launchYear = consoleResult.rows[0].launch_year || null;
      if (data.year_played !== null && launchYear !== null && data.year_played < launchYear) {
        return res.status(400).json({ error: `year_played (${data.year_played}) cannot be before the console launch year (${launchYear})` });
      }
    }

    if (data.year_played !== null && data.release_year !== null && data.year_played < data.release_year) {
      return res.status(400).json({ error: `year_played (${data.year_played}) cannot be before the game release year (${data.release_year})` });
    }

    if (data.completed && data.year_completed !== null && data.year_played !== null) {
      if (data.year_completed < data.year_played) {
        return res.status(400).json({ error: `year_completed (${data.year_completed}) cannot be before year_played (${data.year_played})` });
      }
      if (data.year_completed === data.year_played && data.month_completed !== null && data.month_played !== null && data.month_completed < data.month_played) {
        return res.status(400).json({ error: `month_completed (${data.month_completed}) cannot be before month_played (${data.month_played}) in the same year` });
      }
    }

    const dupQuery = DB_TYPE === 'sqlite'
      ? 'SELECT 1 FROM games WHERE title = ? AND console_id = ?'
      : 'SELECT 1 FROM games WHERE title = $1 AND console_id = $2';
    const dupParams = [data.title, data.console_id];
    const dupResult = await db.query(dupQuery, dupParams);
    if (dupResult.rows.length > 0) {
      return res.status(409).json({ error: 'A game with this title and console already exists' });
    }

    const insertSQL = DB_TYPE === 'sqlite'
      ? 'INSERT INTO games (title, console_id, year_played, month_played, year_completed, month_completed, hours_played, completed, image, release_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      : 'INSERT INTO games (title, console_id, year_played, month_played, year_completed, month_completed, hours_played, completed, image, release_year) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id';

    const params = [data.title, data.console_id, data.year_played, data.month_played, data.year_completed, data.month_completed, data.hours_played, data.completed, data.image, data.release_year];
    const result = await db.query(insertSQL, params);

    const newId = DB_TYPE === 'sqlite' ? result.lastID : result.rows[0].id;
    const game = await fetchGameById(db, newId);

    logger.info({ gameId: newId, title: data.title }, 'Game created');

    res.status(201).json({
      message: 'Game added successfully',
      game,
      success: true
    });
  } catch (error) {
    logger.error({ err: error }, 'Error adding game');
    res.status(500).json({ error: 'Error adding game' });
  }
});

router.put('/games/:id', requireJWT, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid game id' });

    const db = getDatabase();

    const validation = validateGameData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const data = parseGameData(req.body);

    if (data.console_id) {
      const consoleQuery = DB_TYPE === 'sqlite'
        ? 'SELECT launch_year FROM consoles WHERE id = ?'
        : 'SELECT launch_year FROM consoles WHERE id = $1';
      const consoleResult = await db.query(consoleQuery, [data.console_id]);
      if (consoleResult.rows.length === 0) {
        return res.status(400).json({ error: 'Console does not exist' });
      }
      const launchYear = consoleResult.rows[0].launch_year || null;
      if (data.year_played !== null && launchYear !== null && data.year_played < launchYear) {
        return res.status(400).json({ error: `year_played (${data.year_played}) cannot be before the console launch year (${launchYear})` });
      }
    }

    if (data.year_played !== null && data.release_year !== null && data.year_played < data.release_year) {
      return res.status(400).json({ error: `year_played (${data.year_played}) cannot be before the game release year (${data.release_year})` });
    }

    if (data.completed && data.year_completed !== null && data.year_played !== null) {
      if (data.year_completed < data.year_played) {
        return res.status(400).json({ error: `year_completed (${data.year_completed}) cannot be before year_played (${data.year_played})` });
      }
      if (data.year_completed === data.year_played && data.month_completed !== null && data.month_played !== null && data.month_completed < data.month_played) {
        return res.status(400).json({ error: `month_completed (${data.month_completed}) cannot be before month_played (${data.month_played}) in the same year` });
      }
    }

    const updateSQL = DB_TYPE === 'sqlite'
      ? 'UPDATE games SET title = ?, console_id = ?, year_played = ?, month_played = ?, year_completed = ?, month_completed = ?, hours_played = ?, completed = ?, image = ?, release_year = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE games SET title = $1, console_id = $2, year_played = $3, month_played = $4, year_completed = $5, month_completed = $6, hours_played = $7, completed = $8, image = $9, release_year = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $11';

    const params = [data.title, data.console_id, data.year_played, data.month_played, data.year_completed, data.month_completed, data.hours_played, data.completed, data.image, data.release_year, id];
    const result = await db.query(updateSQL, params);

    const affected = DB_TYPE === 'sqlite' ? result.changes : result.rowCount;
    if (!affected) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = await fetchGameById(db, id);

    logger.info({ gameId: id }, 'Game updated');

    res.json({
      message: 'Game updated successfully',
      game,
      success: true
    });
  } catch (error) {
    logger.error({ err: error }, 'Error updating game');
    res.status(500).json({ error: 'Error updating game' });
  }
});

router.delete('/games/:id', requireJWT, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid game id' });

    const db = getDatabase();

    const deleteSQL = DB_TYPE === 'sqlite'
      ? 'DELETE FROM games WHERE id = ?'
      : 'DELETE FROM games WHERE id = $1';

    const result = await db.query(deleteSQL, [id]);

    const affected = DB_TYPE === 'sqlite' ? result.changes : result.rowCount;
    if (!affected) {
      return res.status(404).json({ error: 'Game not found' });
    }

    logger.info({ gameId: id }, 'Game deleted');

    res.json({
      message: 'Game deleted successfully',
      gameId: id,
      success: true
    });
  } catch (error) {
    logger.error({ err: error }, 'Error deleting game');
    res.status(500).json({ error: 'Error deleting game' });
  }
});

export default router;
