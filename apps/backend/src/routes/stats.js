import { Router } from 'express';
import { getDatabase, DB_TYPE } from '../../db/database.js';
import logger from '../../db/logger.js';
import { requireJWT } from '../middleware/auth.js';
import { resolveCatalogId } from './wishlist.js';

const router = Router();

router.get('/stats', requireJWT, async (req, res) => {
  try {
    const db = getDatabase();

    const totalGames = await db.query(
      DB_TYPE === 'sqlite'
        ? 'SELECT COUNT(*) as count FROM games'
        : 'SELECT COUNT(*)::int as count FROM games'
    );

    const totalConsoles = await db.query(
      DB_TYPE === 'sqlite'
        ? 'SELECT COUNT(*) as count FROM consoles'
        : 'SELECT COUNT(*)::int as count FROM consoles'
    );

    const completedGames = await db.query(
      DB_TYPE === 'sqlite'
        ? "SELECT COUNT(*) as count FROM games WHERE completed = 1"
        : 'SELECT COUNT(*)::int as count FROM games WHERE completed = true'
    );

    const gamesByConsole = await db.query(`
      SELECT c.name, COUNT(g.id)${DB_TYPE === 'sqlite' ? '' : '::int'} as count
      FROM consoles c
      LEFT JOIN games g ON g.console_id = c.id
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);

    const gamesByYear = await db.query(`
      SELECT g.year_played, COUNT(g.id)${DB_TYPE === 'sqlite' ? '' : '::int'} as count
      FROM games g
      WHERE g.year_played IS NOT NULL
      GROUP BY g.year_played
      ORDER BY g.year_played DESC
    `);

    const totalCatalog = await db.query(
      DB_TYPE === 'sqlite'
        ? 'SELECT COUNT(*) as count FROM game_catalog'
        : 'SELECT COUNT(*)::int as count FROM game_catalog'
    );

    res.json({
      total_games: totalGames.rows[0].count,
      total_consoles: totalConsoles.rows[0].count,
      completed_games: completedGames.rows[0].count,
      games_by_console: gamesByConsole.rows,
      games_by_year: gamesByYear.rows,
      catalog_size: totalCatalog.rows[0].count,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching stats');
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// Campos de juego que viajan en export/import (además de title y consola).
const GAME_FIELDS = [
  'year_played', 'month_played', 'year_completed', 'month_completed',
  'hours_played', 'release_year', 'completed', 'image',
  'igdb_id', 'igdb_match',
];

const placeholders = (n) => Array.from({ length: n }, (_, i) => (DB_TYPE === 'sqlite' ? '?' : `$${i + 1}`)).join(', ');

const toInt = (v) => (v === undefined || v === null || v === '' ? null : Number.parseInt(v, 10));
const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

function gameValues(g) {
  return {
    year_played: toInt(g.year_played),
    month_played: toInt(g.month_played),
    year_completed: toInt(g.year_completed),
    month_completed: toInt(g.month_completed),
    hours_played: toNum(g.hours_played),
    release_year: toInt(g.release_year),
    completed: g.completed === true || g.completed === 1 || g.completed === 'true',
    image: g.image || null,
    igdb_id: toInt(g.igdb_id),
    igdb_match: g.igdb_match || null,
  };
}

router.get('/export', requireJWT, async (req, res) => {
  try {
    const db = getDatabase();

    const gamesResult = await db.query(
      `SELECT g.id, g.title, ${GAME_FIELDS.map((f) => `g.${f}`).join(', ')},
              c.name as console_name, g.created_at, g.updated_at
       FROM games g LEFT JOIN consoles c ON g.console_id = c.id
       ORDER BY g.created_at`
    );

    const consolesResult = await db.query('SELECT id, name, launch_year FROM consoles ORDER BY id');

    const catalogResult = await db.query(
      DB_TYPE === 'sqlite'
        ? 'SELECT igdb_id, title, console_name, cover_url, rating, release_date FROM game_catalog ORDER BY rating DESC'
        : 'SELECT igdb_id, title, console_name, cover_url, rating, release_date FROM game_catalog ORDER BY rating DESC NULLS LAST'
    );

    const wishlistResult = await db.query(
      `SELECT gc.igdb_id, gc.title, gc.console_name, gc.cover_url, w.sort_order
       FROM game_wishlist w JOIN game_catalog gc ON w.game_catalog_id = gc.id
       ORDER BY w.sort_order`
    );

    res.json({
      exported_at: new Date().toISOString(),
      db_type: DB_TYPE,
      games: gamesResult.rows,
      consoles: consolesResult.rows,
      wishlist: wishlistResult.rows.map((w) => ({ ...w, sort_order: Number(w.sort_order) })),
      catalog: catalogResult.rows,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error exporting data');
    res.status(500).json({ error: 'Error exporting data' });
  }
});

router.post('/import', requireJWT, async (req, res) => {
  try {
    const { games, consoles, wishlist } = req.body;

    if (!Array.isArray(games) && !Array.isArray(consoles) && !Array.isArray(wishlist)) {
      return res.status(400).json({ error: 'Provide games, consoles and/or wishlist arrays' });
    }

    const db = getDatabase();
    let importedConsoles = 0;
    let importedGames = 0;
    let importedWishlist = 0;

    if (Array.isArray(consoles)) {
      for (const c of consoles) {
        if (c.name) {
          try {
            const insertSQL = DB_TYPE === 'sqlite'
              ? 'INSERT OR IGNORE INTO consoles (name, launch_year) VALUES (?, ?)'
              : 'INSERT INTO consoles (name, launch_year) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING';
            await db.query(insertSQL, [c.name.trim(), toInt(c.launch_year)]);
            importedConsoles++;
          } catch (err) {
            logger.warn({ err, name: c.name }, 'Skipping console import');
          }
        }
      }
    }

    if (Array.isArray(games)) {
      const consoleMap = {};
      const consolesResult = await db.query('SELECT id, name FROM consoles');
      for (const row of consolesResult.rows) {
        consoleMap[row.name.toLowerCase()] = row.id;
      }

      const columns = ['title', 'console_id', ...GAME_FIELDS];
      const insertSQL = `INSERT INTO games (${columns.join(', ')}) VALUES (${placeholders(columns.length)})`;

      for (const g of games) {
        if (!g.title) continue;
        try {
          let consoleId = g.console_id || null;
          if (g.console_name && !consoleId) {
            consoleId = consoleMap[g.console_name.toLowerCase()] || null;
          }
          const values = gameValues(g);
          await db.query(insertSQL, [g.title, consoleId, ...GAME_FIELDS.map((f) => values[f])]);
          importedGames++;
        } catch (err) {
          logger.warn({ err, title: g.title }, 'Skipping game import');
        }
      }
    }

    if (Array.isArray(wishlist)) {
      for (const w of wishlist) {
        try {
          const catalogId = await resolveCatalogId(db, { ...w, igdb_id: toInt(w.igdb_id) });
          if (!catalogId) continue;
          const dup = await db.query(
            `SELECT 1 FROM game_wishlist WHERE game_catalog_id = ${placeholders(1)}`,
            [catalogId]
          );
          if (dup.rows.length > 0) continue;
          await db.query(
            `INSERT INTO game_wishlist (game_catalog_id, sort_order) VALUES (${placeholders(2)})`,
            [catalogId, toInt(w.sort_order) ?? 0]
          );
          importedWishlist++;
        } catch (err) {
          logger.warn({ err, igdb_id: w.igdb_id }, 'Skipping wishlist import');
        }
      }
    }

    logger.info({ importedConsoles, importedGames, importedWishlist }, 'Import completed');
    res.json({
      message: 'Import completed',
      imported_consoles: importedConsoles,
      imported_games: importedGames,
      imported_wishlist: importedWishlist,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error importing data');
    res.status(500).json({ error: 'Error importing data' });
  }
});

export default router;
