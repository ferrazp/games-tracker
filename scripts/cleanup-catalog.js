import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { closeDatabase, initializeDatabase, getDatabase } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function cleanupCatalog() {
  console.log('\n=== Game Catalog Cleanup ===\n');

  await initializeDatabase();
  const db = getDatabase();

  const remaining = await db.query('SELECT COUNT(*) as c FROM game_catalog');
  console.log(`Catalog has ${remaining.rows[0].c} games – cleanup disabled (no filtering).`);
  await closeDatabase();
}

cleanupCatalog().catch(err => {
  console.error('\nCleanup failed:', err);
  process.exit(1);
});
