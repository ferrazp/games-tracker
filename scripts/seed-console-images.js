import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDatabase, closeDatabase, DB_TYPE } from '../db/database.js';
import logger from '../db/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CONSOLE_WIKI_MAP = {
  'Family Game': 'Nintendo_Entertainment_System',
  'Super Nintendo': 'Super_Nintendo_Entertainment_System',
  'Nintendo 64': 'Nintendo_64',
  'Dreamcast': 'Dreamcast',
  'PlayStation 1': 'PlayStation_(console)',
  'PlayStation 2': 'PlayStation_2',
  'GameCube': 'GameCube',
  'PlayStation 3': 'PlayStation_3',
  'PlayStation Portable (PSP)': 'PlayStation_Portable',
  'Nintendo DS': 'Nintendo_DS',
  'Nintendo Wii': 'Wii',
  'PlayStation 4': 'PlayStation_4',
  'Nintendo Switch': 'Nintendo_Switch',
  'PlayStation 5': 'PlayStation_5',
  'PC': 'Personal_computer'
};

const FALLBACK_IMAGES = {
  'Dreamcast': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Dreamcast_logo_Japan.svg/250px-Dreamcast_logo_Japan.svg.png',
  'PlayStation 3': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/PlayStation_3_logo.svg/200px-PlayStation_3_logo.svg.png',
  'Xbox 360': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Xbox-360-Consoles-Infobox.png/250px-Xbox-360-Consoles-Infobox.png'
};

const BUILTIN_SVGS = {
  'PlayStation 3': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#003791"><path d="M0 0h24v24H0z"/></svg>',
  'Nintendo 64': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" rx="10" fill="#e6e6e6"/><text x="50" y="42" font-family="Arial,sans-serif" font-size="34" font-weight="900" fill="#4b5563" text-anchor="middle">64</text><text x="50" y="17" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#dc2626" text-anchor="middle">NINTENDO</text></svg>',
  'PlayStation 4': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#003791"><path d="M0 0h24v24H0z"/></svg>'
};

const THUMB_SIZE = 200;
const REQUEST_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const wait = (i + 1) * 5000;
      logger.warn({ retry: i + 1, wait }, 'Rate limited, waiting...');
      await sleep(wait);
      continue;
    }
    return response;
  }
  return null;
}

async function fetchWikipediaImage(consoleName) {
  const fallback = FALLBACK_IMAGES[consoleName];
  if (fallback) {
    logger.info({ consoleName }, 'Using fallback image URL');
    return fallback;
  }

  const wikiTitle = CONSOLE_WIKI_MAP[consoleName] || consoleName.replace(/ /g, '_');
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=${THUMB_SIZE}`;

  try {
    const response = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'GamesTracker/1.0 (console-image-seeder)' }
    });

    if (!response || !response.ok) {
      logger.warn({ consoleName, wikiTitle, status: response?.status }, 'Wikipedia API error');
      return null;
    }

    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') {
      logger.warn({ consoleName, wikiTitle }, 'Wikipedia page not found');
      return null;
    }

    const imageUrl = pages[pageId]?.thumbnail?.source;
    if (!imageUrl) {
      logger.warn({ consoleName, wikiTitle }, 'No thumbnail found');
      return null;
    }

    return imageUrl;
  } catch (error) {
    logger.error({ err: error, consoleName }, 'Error fetching Wikipedia image');
    return null;
  }
}

async function downloadAndBase64(imageUrl) {
  try {
    const response = await fetchWithRetry(imageUrl, {
      headers: { 'User-Agent': 'GamesTracker/1.0 (console-image-seeder)' }
    });

    if (!response || !response.ok) {
      logger.warn({ imageUrl, status: response?.status }, 'Error downloading image');
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    logger.error({ err: error, imageUrl }, 'Error downloading image');
    return null;
  }
}

async function seedConsoleImages() {
  logger.info('Starting console image seeding...');

  await initializeDatabase();
  const db = getDatabase();

  const result = await db.query('SELECT id, name, image FROM consoles ORDER BY id');
  const consoles = result.rows;

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const console of consoles) {
    if (console.image) {
      logger.info({ console: console.name }, 'Already has image, skipping');
      skipped++;
      continue;
    }

    logger.info({ console: console.name }, 'Fetching image...');

    // Check built-in SVGs first (best quality, no download needed)
    const builtin = BUILTIN_SVGS[console.name];
    if (builtin) {
      const b64 = 'data:image/svg+xml;base64,' + Buffer.from(builtin).toString('base64');
      const updateSQL = DB_TYPE === 'sqlite'
        ? 'UPDATE consoles SET image = ? WHERE id = ?'
        : 'UPDATE consoles SET image = $1 WHERE id = $2';
      await db.query(updateSQL, [b64, console.id]);
      logger.info({ console: console.name }, 'Built-in SVG saved');
      seeded++;
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    const imageUrl = await fetchWikipediaImage(console.name);

    if (!imageUrl) {
      logger.warn({ console: console.name }, 'Could not find image URL');
      failed++;
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    const base64 = await downloadAndBase64(imageUrl);
    if (!base64) {
      logger.warn({ console: console.name }, 'Could not download image');
      failed++;
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    const updateSQL = DB_TYPE === 'sqlite'
      ? 'UPDATE consoles SET image = ? WHERE id = ?'
      : 'UPDATE consoles SET image = $1 WHERE id = $2';
    await db.query(updateSQL, [base64, console.id]);
    logger.info({ console: console.name }, 'Image saved successfully');
    seeded++;

    await sleep(REQUEST_DELAY_MS);
  }

  logger.info({ seeded, skipped, failed, total: consoles.length }, 'Console image seeding complete');
  await closeDatabase();
}

seedConsoleImages().catch((err) => {
  logger.error({ err }, 'Seed aborted');
  process.exit(1);
});
