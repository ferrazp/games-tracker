import { Router } from 'express';
import { getDatabase, DB_TYPE } from '../../db/database.js';
import logger from '../../db/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/stats', requireAuth, async (req, res) => {
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

router.get('/export', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();

    const gamesResult = await db.query(
      DB_TYPE === 'sqlite'
        ? `SELECT g.id, g.title, g.year_played, g.completed, g.image, c.name as console_name,
                  g.created_at, g.updated_at
           FROM games g LEFT JOIN consoles c ON g.console_id = c.id
           ORDER BY g.created_at`
        : `SELECT g.id, g.title, g.year_played, g.completed, g.image, c.name as console_name,
                  g.created_at, g.updated_at
           FROM games g LEFT JOIN consoles c ON g.console_id = c.id
           ORDER BY g.created_at`
    );

    const consolesResult = await db.query('SELECT id, name FROM consoles ORDER BY id');

    const catalogResult = await db.query(
      DB_TYPE === 'sqlite'
        ? 'SELECT igdb_id, title, console_name, cover_url, rating, release_date FROM game_catalog ORDER BY rating DESC'
        : 'SELECT igdb_id, title, console_name, cover_url, rating, release_date FROM game_catalog ORDER BY rating DESC NULLS LAST'
    );

    const exportData = {
      exported_at: new Date().toISOString(),
      db_type: DB_TYPE,
      games: gamesResult.rows,
      consoles: consolesResult.rows,
      catalog: catalogResult.rows,
    };

    res.json(exportData);
  } catch (error) {
    logger.error({ err: error }, 'Error exporting data');
    res.status(500).json({ error: 'Error exporting data' });
  }
});

router.post('/import', requireAuth, async (req, res) => {
  try {
    const { games, consoles } = req.body;

    if (!Array.isArray(games) && !Array.isArray(consoles)) {
      return res.status(400).json({ error: 'Provide games and/or consoles arrays' });
    }

    const db = getDatabase();
    let importedConsoles = 0;
    let importedGames = 0;

    if (Array.isArray(consoles)) {
      for (const c of consoles) {
        if (c.name) {
          try {
            const insertSQL = DB_TYPE === 'sqlite'
              ? 'INSERT OR IGNORE INTO consoles (name) VALUES (?)'
              : 'INSERT INTO consoles (name) VALUES ($1) ON CONFLICT (name) DO NOTHING';
            await db.query(insertSQL, [c.name.trim()]);
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

      for (const g of games) {
        if (!g.title) continue;
        try {
          let consoleId = g.console_id || null;
          if (g.console_name && !consoleId) {
            consoleId = consoleMap[g.console_name.toLowerCase()] || null;
          }

          const insertSQL = DB_TYPE === 'sqlite'
            ? `INSERT INTO games (title, console_id, year_played, completed, image)
               VALUES (?, ?, ?, ?, ?)`
            : `INSERT INTO games (title, console_id, year_played, completed, image)
               VALUES ($1, $2, $3, $4, $5)`;

          await db.query(insertSQL, [
            g.title,
            consoleId,
            g.year_played || null,
            g.completed === true || g.completed === 1,
            g.image || null,
          ]);
          importedGames++;
        } catch (err) {
          logger.warn({ err, title: g.title }, 'Skipping game import');
        }
      }
    }

    logger.info({ importedConsoles, importedGames }, 'Import completed');
    res.json({
      message: 'Import completed',
      imported_consoles: importedConsoles,
      imported_games: importedGames,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error importing data');
    res.status(500).json({ error: 'Error importing data' });
  }
});

export default router;
