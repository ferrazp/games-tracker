import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';

const tmpDir = mkdtempSync(join(tmpdir(), 'games-tracker-test-'));
const dbPath = join(tmpDir, 'test.db');

process.env.SQLITE_PATH = dbPath;
process.env.NODE_ENV = 'test';

const { app } = await import('../../../server-unified.js');
const { initializeDatabase, getDatabase } = await import('../../../db/database.js');

await initializeDatabase();
const db = getDatabase();
const result = await db.query("INSERT INTO consoles (name, launch_year) VALUES ('Test Console', 2000)");
const testConsoleId = result.lastID;

const catalogEntries = [
  'Test Game', 'Updated Game', 'Orphan Game', 'Time Travel Game',
  'Bad Console Game', 'String Console Game', 'Ghost', 'Bad'
];
for (let i = 0; i < catalogEntries.length; i++) {
  await db.query(
    "INSERT INTO game_catalog (igdb_id, title, console_name, release_date) VALUES (?, ?, '', 2020)",
    [i + 999, catalogEntries[i]]
  );
}

const loginRes = await request(app)
  .post('/auth/login')
  .send({ username: 'admin', password: '1234' });
const authToken = loginRes.body.token;

export function getApp() { return app; }
export function getAuth() { return `Bearer ${authToken}`; }
export function getTestConsoleId() { return testConsoleId; }
