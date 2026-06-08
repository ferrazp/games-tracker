import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { initializeDatabase, getDatabase, closeDatabase, DB_TYPE } from './database.js';
import logger from './logger.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

async function getAppliedMigrations(db) {
  try {
    const result = await db.query('SELECT name FROM _migrations ORDER BY id');
    return new Set(result.rows.map(r => r.name));
  } catch {
    return new Set();
  }
}

async function markApplied(db, name) {
  if (DB_TYPE === 'sqlite') {
    await db.query('INSERT INTO _migrations (name) VALUES (?)', [name]);
  } else {
    await db.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
  }
}

async function migrate() {
  logger.info('Starting migrations...');

  await initializeDatabase();
  const db = getDatabase();

  const applied = await getAppliedMigrations(db);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => extname(f) === '.sql')
    .sort();

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) {
      logger.debug({ migration: file }, 'Already applied, skipping');
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    try {
      await db.query(sql);
      await markApplied(db, file);
      logger.info({ migration: file }, 'Migration applied');
      count++;
    } catch (err) {
      logger.error({ err, migration: file }, 'Migration failed');
      throw err;
    }
  }

  logger.info({ applied: count, total: files.length }, 'Migrations complete');
  await closeDatabase();
}

migrate().catch((err) => {
  logger.error({ err }, 'Migration aborted');
  process.exit(1);
});
