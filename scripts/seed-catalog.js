import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDatabase, closeDatabase, DB_TYPE } from '../db/database.js';
import logger from '../db/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const PLATFORM_MAP = {
  'Family Game': 18,
  'Super Nintendo': 19,
  'Nintendo 64': 4,
  'Dreamcast': 23,
  'PlayStation 1': 7,
  'PlayStation 2': 8,
  'GameCube': 21,
  'PlayStation 3': 9,
  'PlayStation Portable (PSP)': 38,
  'Nintendo DS': 20,
  'Nintendo Wii': 5,
  'PlayStation 4': 48,
  'Nintendo Switch': 130,
  'PlayStation 5': 167,
  'PC': 6
};

const CONCURRENCY = 10;
const IGDB_MAX_LIMIT = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAccessToken() {
  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!response.ok) throw new Error(`Twitch auth failed: ${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error('No access token in response');
  return data.access_token;
}

async function fetchTopGames(platformId, accessToken, totalNeeded = 1000) {
  const allGames = [];
  const batchSize = Math.min(totalNeeded, IGDB_MAX_LIMIT);

  while (allGames.length < totalNeeded) {
    const limit = Math.min(batchSize, totalNeeded - allGames.length);
    const response = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: `fields name,cover.url,rating,first_release_date; where platforms = (${platformId}) & rating > 0; sort rating desc; limit ${limit}; offset ${allGames.length};`
    });

    if (!response.ok) {
      console.error(`  IGDB error ${response.status} for platform ${platformId}`);
      return { games: allGames, rawCount: allGames.length };
    }

    const games = await response.json();
    if (games.length === 0) break;

    allGames.push(...games);

    if (games.length < limit) break;

    await sleep(300);
  }

  return { games: allGames, rawCount: allGames.length };
}

async function imageToBase64(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

async function downloadImagesConcurrent(items, getUrl, onProgress) {
  const withCover = items.filter(item => getUrl(item));
  if (withCover.length === 0) return;

  let completed = 0;
  const total = withCover.length;

  const queue = [...withCover];
  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      const imageUrl = getUrl(item);
      item._coverBase64 = await imageToBase64(imageUrl);
      completed++;
      if (completed % 50 === 0 || completed === total) {
        const pct = ((completed / total) * 100).toFixed(0);
        console.log(`   Images: ${completed}/${total} (${pct}%)`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  if (onProgress) onProgress(total);
}

async function seedCatalog() {
  console.log('\n=== Game Catalog Seeder ===\n');

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.error(' TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const withImages = process.argv.includes('--download-images');
  const imagesOnly = process.argv.includes('--images-only');
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const GAMES_PER_PLATFORM = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1000;

  await initializeDatabase();
  const db = getDatabase();

  const existingResult = await db.query('SELECT igdb_id, cover_url FROM game_catalog');
  const existingIds = new Set(existingResult.rows.map(r => r.igdb_id));
  const existingUrlGames = existingResult.rows.filter(r => r.cover_url && !r.cover_url.startsWith('data:'));
  console.log(` Already in catalog: ${existingIds.size} games`);
  console.log(` With URL covers (not base64): ${existingUrlGames.length} games\n`);

  if (imagesOnly) {
    if (withImages && existingUrlGames.length > 0) {
      await convertExistingUrlCovers(existingUrlGames, db);
    } else {
      console.log(' No URL covers to convert.');
    }
    await printFinalSummary(db);
    return;
  }

  console.log(' Getting Twitch access token...');
  const accessToken = await getAccessToken();
  console.log(' Token obtained\n');

  let totalNew = 0;

  for (const [consoleName, platformId] of Object.entries(PLATFORM_MAP)) {
    console.log(` ${consoleName} (platform ${platformId})...`);

    const { games, rawCount } = await fetchTopGames(platformId, accessToken, GAMES_PER_PLATFORM);
    console.log(`   Found ${rawCount} games on IGDB`);

    const newGames = games.filter(g => !existingIds.has(g.id));
    console.log(`   ${newGames.length} new, ${games.length - newGames.length} already in catalog`);

    if (newGames.length > 0) {
      if (withImages) {
        console.log(`   Downloading covers for ${newGames.length} new games...`);
        await downloadImagesConcurrent(
          newGames,
          g => g.cover?.url ? `https:${g.cover.url.replace('/t_thumb/', '/t_cover_big/')}` : null
        );
      }

      const insertSQL = DB_TYPE === 'sqlite'
        ? 'INSERT OR IGNORE INTO game_catalog (igdb_id, title, console_name, cover_url, rating, release_date) VALUES (?, ?, ?, ?, ?, ?)'
        : 'INSERT INTO game_catalog (igdb_id, title, console_name, cover_url, rating, release_date) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (igdb_id) DO NOTHING';

      await db.query('BEGIN');
      let inserted = 0;
      for (const game of newGames) {
        try {
          const coverValue = withImages && game._coverBase64
            ? game._coverBase64
            : (game.cover?.url ? `https:${game.cover.url.replace('/t_thumb/', '/t_cover_big/')}` : null);

          await db.query(insertSQL, [
            game.id,
            game.name,
            consoleName,
            coverValue,
            game.rating || null,
            game.first_release_date || null
          ]);
          inserted++;
        } catch (err) {
          if (DB_TYPE === 'sqlite' && err.message?.includes('UNIQUE')) continue;
          if (DB_TYPE !== 'sqlite' && err.code === '23505') continue;
          logger.error({ err: err.message, igdb_id: game.id }, 'Error inserting game');
        }
      }
      await db.query('COMMIT');
      console.log(`   Inserted: ${inserted}`);
      totalNew += inserted;
    }

    await sleep(300);
    console.log();
  }

  if (withImages && existingUrlGames.length > 0) {
    await convertExistingUrlCovers(existingUrlGames, db);
  }

  await printFinalSummary(db, totalNew);
}

async function convertExistingUrlCovers(urlGames, db) {
  console.log(`\n=== Downloading images for ${urlGames.length} existing games with URL covers ===\n`);

  const updateSQL = DB_TYPE === 'sqlite'
    ? 'UPDATE game_catalog SET cover_url = ? WHERE igdb_id = ?'
    : 'UPDATE game_catalog SET cover_url = $1 WHERE igdb_id = $2';

  await downloadImagesConcurrent(
    urlGames,
    r => {
      const url = r.cover_url;
      if (!url || url.startsWith('data:')) return null;
      return url.startsWith('http') ? url.replace('/t_thumb/', '/t_cover_big/') : `https:${url.replace('/t_thumb/', '/t_cover_big/')}`;
    },
    async (total) => {
      console.log(`   Updating ${total} games in database...`);
    }
  );

  let updatedCount = 0;
  for (const game of urlGames) {
    if (game._coverBase64) {
      try {
        await db.query(updateSQL, [game._coverBase64, game.igdb_id]);
        updatedCount++;
      } catch (err) {
        logger.error({ err: err.message, igdb_id: game.igdb_id }, 'Error updating cover');
      }
    }
  }
  console.log(`   Updated: ${updatedCount}\n`);
}

async function printFinalSummary(db, totalNew = 0) {
  const finalResult = await db.query('SELECT COUNT(*) as count FROM game_catalog');
  const base64Count = await db.query("SELECT COUNT(*) as c FROM game_catalog WHERE cover_url LIKE 'data:%'");
  console.log(`\n Final summary:`);
  console.log(`   Total games: ${finalResult.rows[0].count}`);
  console.log(`   With base64 images: ${base64Count.rows[0].c}`);
  if (totalNew !== undefined) console.log(`   New this run: ${totalNew}`);
  await closeDatabase();
}

seedCatalog().catch(err => {
  console.error('\n Seed failed:', err);
  process.exit(1);
});
