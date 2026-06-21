import { Router } from 'express';
import { getDatabase, DB_TYPE } from '../../db/database.js';
import logger from '../../db/logger.js';
import { requireJWT } from '../middleware/auth.js';

const router = Router();

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function fetchWishlistItem(db, id) {
  if (DB_TYPE === 'sqlite') {
    const result = await db.query(
      `SELECT w.id, w.game_catalog_id, w.sort_order, c.title, c.console_name, c.cover_url, w.created_at, w.updated_at
       FROM game_wishlist w
       JOIN game_catalog c ON w.game_catalog_id = c.id
       WHERE w.id = ?`,
      [id]
    );
    return result.rows[0] || null;
  }
  const result = await db.query(
    `SELECT w.id, w.game_catalog_id, w.sort_order, c.title, c.console_name, c.cover_url, w.created_at, w.updated_at
     FROM game_wishlist w
     JOIN game_catalog c ON w.game_catalog_id = c.id
     WHERE w.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

router.get('/wishlist', requireJWT, async (req, res) => {
  try {
    const db = getDatabase();

    const query = DB_TYPE === 'sqlite'
      ? `SELECT w.id, w.game_catalog_id, w.sort_order, c.title, c.console_name, c.cover_url, w.created_at, w.updated_at
         FROM game_wishlist w
         JOIN game_catalog c ON w.game_catalog_id = c.id
         ORDER BY w.sort_order ASC, w.id ASC`
      : `SELECT w.id, w.game_catalog_id, w.sort_order, c.title, c.console_name, c.cover_url, w.created_at, w.updated_at
         FROM game_wishlist w
         JOIN game_catalog c ON w.game_catalog_id = c.id
         ORDER BY w.sort_order ASC, w.id ASC`;

    const result = await db.query(query);

    res.json({ games: result.rows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching wishlist');
    res.status(500).json({ error: 'Error fetching wishlist' });
  }
});

async function resolveCatalogId(db, body) {
  const { game_catalog_id, igdb_id, title, console_name, cover_url } = body;

  if (game_catalog_id && Number.isInteger(game_catalog_id) && game_catalog_id > 0) {
    const exists = await db.query(
      DB_TYPE === 'sqlite'
        ? 'SELECT id FROM game_catalog WHERE id = ?'
        : 'SELECT id FROM game_catalog WHERE id = $1',
      [game_catalog_id]
    );
    if (exists.rows.length > 0) return game_catalog_id;
  }

  if (igdb_id && Number.isInteger(igdb_id) && igdb_id > 0) {
    const lookup = await db.query(
      DB_TYPE === 'sqlite'
        ? 'SELECT id FROM game_catalog WHERE igdb_id = ?'
        : 'SELECT id FROM game_catalog WHERE igdb_id = $1',
      [igdb_id]
    );
    if (lookup.rows.length > 0) return lookup.rows[0].id;

    if (title) {
      const insertSQL = DB_TYPE === 'sqlite'
        ? 'INSERT INTO game_catalog (igdb_id, title, console_name, cover_url) VALUES (?, ?, ?, ?)'
        : 'INSERT INTO game_catalog (igdb_id, title, console_name, cover_url) VALUES ($1, $2, $3, $4) RETURNING id';
      const params = [igdb_id, title, console_name || null, cover_url || null];
      const result = await db.query(insertSQL, params);
      return DB_TYPE === 'sqlite' ? result.lastID : result.rows[0].id;
    }
  }

  return null;
}

router.post('/wishlist', requireJWT, async (req, res) => {
  try {
    const db = getDatabase();

    const catalogId = await resolveCatalogId(db, req.body);

    if (!catalogId) {
      return res.status(400).json({ error: 'Provide a valid game_catalog_id or igdb_id with title' });
    }

    const dupQuery = DB_TYPE === 'sqlite'
      ? 'SELECT 1 FROM game_wishlist WHERE game_catalog_id = ?'
      : 'SELECT 1 FROM game_wishlist WHERE game_catalog_id = $1';
    const dupResult = await db.query(dupQuery, [catalogId]);
    if (dupResult.rows.length > 0) {
      return res.status(409).json({ error: 'This game is already in your wishlist' });
    }

    const maxQuery = DB_TYPE === 'sqlite'
      ? 'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM game_wishlist'
      : 'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM game_wishlist';
    const maxResult = await db.query(maxQuery);
    const nextOrder = maxResult.rows[0].next_order;

    const insertSQL = DB_TYPE === 'sqlite'
      ? 'INSERT INTO game_wishlist (game_catalog_id, sort_order) VALUES (?, ?)'
      : 'INSERT INTO game_wishlist (game_catalog_id, sort_order) VALUES ($1, $2) RETURNING id';

    const params = [catalogId, nextOrder];
    const result = await db.query(insertSQL, params);

    const newId = DB_TYPE === 'sqlite' ? result.lastID : result.rows[0].id;
    const item = await fetchWishlistItem(db, newId);

    logger.info({ wishlistId: newId, gameCatalogId: catalogId }, 'Game added to wishlist');

    res.status(201).json({
      message: 'Game added to wishlist',
      game: item,
      success: true
    });
  } catch (error) {
    logger.error({ err: error }, 'Error adding to wishlist');
    res.status(500).json({ error: 'Error adding to wishlist' });
  }
});

router.put('/wishlist/reorder', requireJWT, async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array of {id, sort_order}' });
    }

    for (const item of items) {
      if (!Number.isInteger(item.id) || item.id < 1 || !Number.isInteger(item.sort_order) || item.sort_order < 0) {
        return res.status(400).json({ error: 'Each item must have a valid id (positive integer) and sort_order (non-negative integer)' });
      }
    }

    const db = getDatabase();

    if (DB_TYPE === 'sqlite') {
      await db.query('BEGIN');
      try {
        for (const item of items) {
          await db.query('UPDATE game_wishlist SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.sort_order, item.id]);
        }
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK');
        throw err;
      }
    } else {
      for (const item of items) {
        await db.query('UPDATE game_wishlist SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [item.sort_order, item.id]);
      }
    }

    const query = DB_TYPE === 'sqlite'
      ? `SELECT w.id, w.game_catalog_id, w.sort_order, c.title, c.console_name, c.cover_url, w.created_at, w.updated_at
         FROM game_wishlist w
         JOIN game_catalog c ON w.game_catalog_id = c.id
         ORDER BY w.sort_order ASC, w.id ASC`
      : `SELECT w.id, w.game_catalog_id, w.sort_order, c.title, c.console_name, c.cover_url, w.created_at, w.updated_at
         FROM game_wishlist w
         JOIN game_catalog c ON w.game_catalog_id = c.id
         ORDER BY w.sort_order ASC, w.id ASC`;

    const result = await db.query(query);

    logger.info({ count: items.length }, 'Wishlist reordered');

    res.json({
      message: 'Wishlist reordered successfully',
      games: result.rows,
      success: true
    });
  } catch (error) {
    logger.error({ err: error }, 'Error reordering wishlist');
    res.status(500).json({ error: 'Error reordering wishlist' });
  }
});

router.delete('/wishlist/:id', requireJWT, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const db = getDatabase();

    const deleteSQL = DB_TYPE === 'sqlite'
      ? 'DELETE FROM game_wishlist WHERE id = ?'
      : 'DELETE FROM game_wishlist WHERE id = $1';

    const result = await db.query(deleteSQL, [id]);

    const affected = DB_TYPE === 'sqlite' ? result.changes : result.rowCount;
    if (!affected) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    logger.info({ wishlistId: id }, 'Game removed from wishlist');

    res.json({
      message: 'Game removed from wishlist',
      id,
      success: true
    });
  } catch (error) {
    logger.error({ err: error }, 'Error removing from wishlist');
    res.status(500).json({ error: 'Error removing from wishlist' });
  }
});

export default router;
