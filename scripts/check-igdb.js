import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDatabase, closeDatabase } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  await initializeDatabase();
  const db = getDatabase();
  const r = await db.query(
    `SELECT igdb_id, title, console_name FROM game_catalog WHERE title LIKE '%Super Mario Bros%' ORDER BY title, console_name`
  );
  const ids = r.rows.map(x => x.igdb_id).join(',');

  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const response = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: `fields name,version_parent,platforms; where id = (${ids}); limit 50;`
  });
  const games = await response.json();
  for (const g of games) {
    console.log(g.id, g.name, 'version_parent:', g.version_parent || 'null', 'platforms:', JSON.stringify(g.platforms));
  }
  await closeDatabase();
}

main().catch(e => { console.error(e); process.exit(1); });
