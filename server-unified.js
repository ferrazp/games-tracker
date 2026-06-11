import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDatabase, closeDatabase, DB_TYPE } from './db/database.js';
import logger from './db/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendPkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'games-tracker-secret-key-change-in-production';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '1234';

let twitchToken = { value: null, expiresAt: 0 };

async function getTwitchToken() {
  if (twitchToken.value && Date.now() < twitchToken.expiresAt - 60_000) {
    return twitchToken.value;
  }
  const tokenResponse = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!tokenResponse.ok) {
    throw new Error(`Twitch auth failed: ${tokenResponse.status}`);
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('No access token in Twitch response');
  }
  twitchToken.value = tokenData.access_token;
  twitchToken.expiresAt = Date.now() + tokenData.expires_in * 1000;
  return twitchToken.value;
}

const app = express();
const port = process.env.PORT || 4000;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const HAS_TWITCH_CREDENTIALS = !!(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);
const API_KEY = process.env.API_KEY || '';

const IGDB_PLATFORM_TO_CONSOLE = {
  18: 'Family Game',
  19: 'Super Nintendo',
  4: 'Nintendo 64',
  23: 'Dreamcast',
  7: 'PlayStation 1',
  8: 'PlayStation 2',
  21: 'GameCube',
  9: 'PlayStation 3',
  38: 'PlayStation Portable (PSP)',
  20: 'Nintendo DS',
  5: 'Nintendo Wii',
  48: 'PlayStation 4',
  130: 'Nintendo Switch',
  167: 'PlayStation 5',
  6: 'PC'
};

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  logger.debug({ method: req.method, url: req.originalUrl }, 'request');
  next();
});

const searchOnlineLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

function requireAuth(req, res, next) {
  if (!API_KEY) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Provide x-api-key header.' });
  }
  next();
}

function requireJWT(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/version', (req, res) => {
  res.json({ version: backendPkg.version, name: backendPkg.name });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  logger.info({ username }, 'Login successful');
  res.json({ token, user: { username, role: 'admin' } });
});

function validateSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query must be a non-empty string' };
  }
  if (query.length < 1 || query.length > 100) {
    return { valid: false, error: 'Query must be between 1 and 100 characters' };
  }
  return { valid: true };
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function validateGameData(data) {
  const { title, console_id, year_played, month_played, year_completed, month_completed, hours_played, release_year, image } = data;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { valid: false, error: 'Title is required and must be a string' };
  }

  if (console_id !== undefined && console_id !== null && console_id !== '') {
    const c = typeof console_id === 'number' ? console_id : parseInt(console_id, 10);
    if (isNaN(c) || !Number.isInteger(c) || c < 1) {
      return { valid: false, error: 'console_id must be a positive integer' };
    }
  }

  if (year_played !== undefined && year_played !== null && year_played !== '') {
    const y = typeof year_played === 'number' ? year_played : parseInt(year_played, 10);
    if (isNaN(y) || !Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR) {
      return { valid: false, error: `year_played must be an integer between 1950 and ${CURRENT_YEAR}` };
    }
    const hasConsole = console_id !== undefined && console_id !== null && console_id !== '';
    if (!hasConsole) {
      return { valid: false, error: 'console_id is required when year_played is provided' };
    }
  }

  if (month_played !== undefined && month_played !== null && month_played !== '') {
    const m = typeof month_played === 'number' ? month_played : parseInt(month_played, 10);
    if (isNaN(m) || !Number.isInteger(m) || m < 1 || m > 12) {
      return { valid: false, error: 'month_played must be an integer between 1 and 12' };
    }
  }

  if (year_completed !== undefined && year_completed !== null && year_completed !== '') {
    const y = typeof year_completed === 'number' ? year_completed : parseInt(year_completed, 10);
    if (isNaN(y) || !Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR) {
      return { valid: false, error: `year_completed must be an integer between 1950 and ${CURRENT_YEAR}` };
    }
  }

  if (month_completed !== undefined && month_completed !== null && month_completed !== '') {
    const m = typeof month_completed === 'number' ? month_completed : parseInt(month_completed, 10);
    if (isNaN(m) || !Number.isInteger(m) || m < 1 || m > 12) {
      return { valid: false, error: 'month_completed must be an integer between 1 and 12' };
    }
  }

  if (hours_played !== undefined && hours_played !== null && hours_played !== '') {
    const h = typeof hours_played === 'number' ? hours_played : parseFloat(hours_played);
    if (isNaN(h) || h < 0) {
      return { valid: false, error: 'hours_played must be a positive number' };
    }
  }

  if (image !== undefined && image !== null && image !== '') {
    if (typeof image !== 'string') {
      return { valid: false, error: 'image must be a string' };
    }
  }

  if (release_year !== undefined && release_year !== null && release_year !== '') {
    const y = typeof release_year === 'number' ? release_year : parseInt(release_year, 10);
    if (isNaN(y) || !Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR) {
      return { valid: false, error: `release_year must be an integer between 1950 and ${CURRENT_YEAR}` };
    }
  }

  return { valid: true };
}

function parseGameData(data) {
  const rawConsoleId = data.console_id;
  const rawYear = data.year_played;
  const rawMonth = data.month_played;
  const rawYearCompleted = data.year_completed;
  const rawMonthCompleted = data.month_completed;
  const rawHours = data.hours_played;
  const rawReleaseYear = data.release_year;

  return {
    title: data.title.trim(),
    console_id: rawConsoleId !== undefined && rawConsoleId !== null && rawConsoleId !== ''
      ? parseInt(rawConsoleId, 10) : null,
    year_played: rawYear !== undefined && rawYear !== null && rawYear !== ''
      ? parseInt(rawYear, 10) : null,
    month_played: rawMonth !== undefined && rawMonth !== null && rawMonth !== ''
      ? parseInt(rawMonth, 10) : null,
    year_completed: rawYearCompleted !== undefined && rawYearCompleted !== null && rawYearCompleted !== ''
      ? parseInt(rawYearCompleted, 10) : null,
    month_completed: rawMonthCompleted !== undefined && rawMonthCompleted !== null && rawMonthCompleted !== ''
      ? parseInt(rawMonthCompleted, 10) : null,
    hours_played: rawHours !== undefined && rawHours !== null && rawHours !== ''
      ? parseFloat(rawHours) : null,
    completed: data.completed === true || data.completed === 'true',
    image: data.image || null,
    release_year: rawReleaseYear !== undefined && rawReleaseYear !== null && rawReleaseYear !== ''
      ? parseInt(rawReleaseYear, 10) : null
  };
}

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

app.get('/stats', requireAuth, async (req, res) => {
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

app.get('/export', requireAuth, async (req, res) => {
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

app.post('/import', requireAuth, async (req, res) => {
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

app.post('/search', async (req, res) => {
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
      online_available: HAS_TWITCH_CREDENTIALS && games.length === 0
    });
  } catch (error) {
    logger.error({ err: error }, 'Error searching local catalog');
    res.status(500).json({ error: 'Error searching games.' });
  }
});

app.post('/search/online', searchOnlineLimiter, async (req, res) => {
  try {
    if (!HAS_TWITCH_CREDENTIALS) {
      return res.status(400).json({ error: 'Twitch credentials not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env' });
    }

    const { query } = req.body;

    const validation = validateSearchQuery(query);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const accessToken = await getTwitchToken();

    const sanitizedQuery = query.replace(/"/g, '\\"');

    const igdbResponse = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: `fields name,cover.url,platforms.name,first_release_date; search "${sanitizedQuery}"; limit 10;`
    });

    if (!igdbResponse.ok) {
      throw new Error(`IGDB API error: ${igdbResponse.status}`);
    }

    const data = await igdbResponse.json();
    const results = (Array.isArray(data) ? data : []).map(g => {
      const platform = Array.isArray(g.platforms) ? g.platforms[0] : null;
      const mappedName = platform ? IGDB_PLATFORM_TO_CONSOLE[platform.id] : null;
      return {
        id: g.id,
        name: g.name,
        cover: g.cover?.url ? { url: g.cover.url.replace('/t_thumb/', '/t_cover_big/') } : null,
        console_name: mappedName,
        platform_name: platform?.name || null,
        first_release_date: g.first_release_date || null
      };
    });
    res.json({ results, source: 'online' });
  } catch (error) {
    logger.error({ err: error }, 'Error searching IGDB');
    res.status(500).json({ error: 'Error searching online. Please try again.' });
  }
});

app.get('/games', async (req, res) => {
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderClause = isSQLite ? 'ORDER BY g.created_at DESC' : 'ORDER BY g.created_at DESC NULLS LAST';

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

app.get('/games/:id', async (req, res) => {
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

app.post('/games', requireJWT, async (req, res) => {
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

app.put('/games/:id', requireJWT, async (req, res) => {
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

app.delete('/games/:id', requireJWT, async (req, res) => {
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

app.get('/consoles', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT id, name, launch_year FROM consoles ORDER BY name ASC');
    res.json({ consoles: result.rows });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching consoles');
    res.status(500).json({ error: 'Error fetching consoles' });
  }
});

app.post('/consoles', requireJWT, async (req, res) => {
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

app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(port, () => {
      logger.info({ port, dbType: DB_TYPE.toUpperCase() }, 'Server started');
      if (API_KEY) logger.info('API key auth enabled');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app };
