import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDatabase, DB_TYPE } from '../../db/database.js';
import logger from '../../db/logger.js';
import { config } from '../config.js';
import { getTwitchToken } from '../services/twitch.js';
import { IGDB_PLATFORM_TO_CONSOLE } from '../services/igdb.js';
import { validateSearchQuery } from '../validators/search.js';

const router = Router();

const IMAGE_CONCURRENCY = 10;

async function imageToBase64(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

async function persistToCatalog(games) {
  const db = getDatabase();
  const ids = games.map(g => g.igdb_id);
  const placeholders = ids.map((_, i) => DB_TYPE === 'sqlite' ? '?' : `$${i + 1}`).join(',');
  const existingResult = await db.query(`SELECT igdb_id FROM game_catalog WHERE igdb_id IN (${placeholders})`, ids);
  const existingIds = new Set(existingResult.rows.map(r => r.igdb_id));
  const newGames = games.filter(g => !existingIds.has(g.igdb_id));

  if (newGames.length === 0) return [];

  const insertSQL = DB_TYPE === 'sqlite'
    ? 'INSERT OR IGNORE INTO game_catalog (igdb_id, title, console_name, cover_url, release_date) VALUES (?, ?, ?, ?, ?)'
    : 'INSERT INTO game_catalog (igdb_id, title, console_name, cover_url, release_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (igdb_id) DO NOTHING';

  await db.query('BEGIN');
  for (const game of newGames) {
    try {
      let coverValue = game.cover_url;
      if (coverValue && coverValue.startsWith('//')) {
        coverValue = `https:${coverValue.replace('/t_thumb/', '/t_cover_big/')}`;
      }
      await db.query(insertSQL, [game.igdb_id, game.name, game.console_name, coverValue, game.release_date || null]);
    } catch (err) {
      if (DB_TYPE === 'sqlite' && err.message?.includes('UNIQUE')) continue;
      if (DB_TYPE !== 'sqlite' && err.code === '23505') continue;
      logger.error({ err: err.message, igdb_id: game.igdb_id }, 'Error inserting game');
    }
  }
  await db.query('COMMIT');

  return newGames;
}

const searchOnlineLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

router.post('/search', async (req, res) => {
  try {
    const { query, console_id } = req.body;

    const validation = validateSearchQuery(query);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const db = getDatabase();
    const searchPattern = `%${query}%`;

    let consoleName = null;
    if (console_id && console_id !== '') {
      const cQuery = DB_TYPE === 'sqlite'
        ? 'SELECT name FROM consoles WHERE id = ?'
        : 'SELECT name FROM consoles WHERE id = $1';
      const cResult = await db.query(cQuery, [console_id]);
      if (cResult.rows.length > 0) {
        consoleName = cResult.rows[0].name;
      }
    }

    let searchSQL;
    let params;
    if (consoleName) {
      searchSQL = DB_TYPE === 'sqlite'
        ? `SELECT igdb_id as id, title as name, console_name, cover_url, rating, release_date FROM game_catalog WHERE title LIKE ? AND console_name = ? ORDER BY rating DESC LIMIT 10`
        : `SELECT igdb_id as id, title as name, console_name, cover_url, rating, release_date FROM game_catalog WHERE title ILIKE $1 AND console_name = $2 ORDER BY rating DESC NULLS LAST LIMIT 10`;
      params = [searchPattern, consoleName];
    } else {
      searchSQL = DB_TYPE === 'sqlite'
        ? `SELECT igdb_id as id, title as name, console_name, cover_url, rating, release_date FROM game_catalog WHERE title LIKE ? ORDER BY rating DESC LIMIT 10`
        : `SELECT igdb_id as id, title as name, console_name, cover_url, rating, release_date FROM game_catalog WHERE title ILIKE $1 ORDER BY rating DESC NULLS LAST LIMIT 10`;
      params = [searchPattern];
    }

    const result = await db.query(searchSQL, params);

    const games = result.rows.map(g => ({
      id: g.id,
      name: g.name,
      console_name: g.console_name,
      cover: g.cover_url ? { url: g.cover_url } : null,
      release_date: g.release_date || null
    }));

    res.json({
      results: games,
      source: 'local',
      online_available: config.twitch.hasCredentials
    });
  } catch (error) {
    logger.error({ err: error }, 'Error searching local catalog');
    res.status(500).json({ error: 'Error searching games.' });
  }
});

router.post('/search/online', searchOnlineLimiter, async (req, res) => {
  try {
    if (!config.twitch.hasCredentials) {
      return res.status(400).json({ error: 'Twitch credentials not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env' });
    }

    const { query, console_id } = req.body;

    const validation = validateSearchQuery(query);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const accessToken = await getTwitchToken();

    const sanitizedQuery = query.replace(/"/g, '\\"');

    let platformFilter = '';
    if (console_id) {
      const db = getDatabase();
      const consoleQuery = DB_TYPE === 'sqlite'
        ? 'SELECT name FROM consoles WHERE id = ?'
        : 'SELECT name FROM consoles WHERE id = $1';
      const consoleResult = await db.query(consoleQuery, [parseInt(console_id)]);
      if (consoleResult.rows.length > 0) {
        const consoleName = consoleResult.rows[0].name;
        const platformIds = Object.entries(IGDB_PLATFORM_TO_CONSOLE)
          .filter(([, name]) => name === consoleName)
          .map(([id]) => id);
        if (platformIds.length > 0) {
          platformFilter = ` where platforms = (${platformIds.join(',')});`;
        }
      }
    }

    const igdbResponse = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': config.twitch.clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: `fields name,cover.url,platforms.name,first_release_date; search "${sanitizedQuery}";${platformFilter} limit 10;`
    });

    if (!igdbResponse.ok) {
      throw new Error(`IGDB API error: ${igdbResponse.status}`);
    }

    const data = await igdbResponse.json();
    if (!Array.isArray(data)) {
      return res.json({ results: [], source: 'online' });
    }

    const igdbGames = data.map(g => {
      const platform = Array.isArray(g.platforms) ? g.platforms[0] : null;
      const mappedName = platform ? IGDB_PLATFORM_TO_CONSOLE[platform.id] : null;
      return {
        igdb_id: g.id,
        name: g.name,
        cover_url: g.cover?.url || null,
        console_name: mappedName,
        platform_name: platform?.name || null,
        release_date: g.first_release_date || null
      };
    });

    const newGames = await persistToCatalog(igdbGames);

    if (newGames.length > 0) {
      const withCover = newGames.filter(g => g.cover_url);
      if (withCover.length > 0) {
        let completed = 0;
        const queue = [...withCover];
        async function worker() {
          while (queue.length > 0) {
            const game = queue.shift();
            const fullUrl = game.cover_url.startsWith('//')
              ? `https:${game.cover_url.replace('/t_thumb/', '/t_cover_big/')}`
              : game.cover_url;
            const base64 = await imageToBase64(fullUrl);
            if (base64) {
              try {
                const db = getDatabase();
                const updateSQL = DB_TYPE === 'sqlite'
                  ? 'UPDATE game_catalog SET cover_url = ? WHERE igdb_id = ?'
                  : 'UPDATE game_catalog SET cover_url = $1 WHERE igdb_id = $2';
                await db.query(updateSQL, [base64, game.igdb_id]);
              } catch (err) {
                logger.error({ err: err.message, igdb_id: game.igdb_id }, 'Error updating cover');
              }
            }
            completed++;
          }
        }
        const workers = Array.from({ length: IMAGE_CONCURRENCY }, () => worker());
        await Promise.all(workers);
      }
    }

    let results = igdbGames.map(g => ({
      id: g.igdb_id,
      name: g.name,
      cover: g.cover_url ? { url: g.cover_url.replace('/t_thumb/', '/t_cover_big/') } : null,
      console_name: g.console_name,
      platform_name: g.platform_name,
      first_release_date: g.release_date
    }));

    if (console_id) {
      results = results.filter(g => g.console_name);
    }

    res.json({ results, source: 'online' });
  } catch (error) {
    logger.error({ err: error }, 'Error searching IGDB');
    res.status(500).json({ error: 'Error searching online. Please try again.' });
  }
});

export default router;
