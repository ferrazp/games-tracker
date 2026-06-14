import pg from 'pg';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

let client = null;

class SQLiteClient {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async connect() {
    const sqlite3 = await import('sqlite3');
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.default.Database(process.env.SQLITE_PATH || './games.db', (err) => {
        if (err) {
          logger.error({ err }, 'Error opening SQLite database');
          reject(err);
        } else {
          logger.info('Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async initialize() {
    if (this.initialized) return;

    const schemaSQL = `
      CREATE TABLE IF NOT EXISTS consoles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        launch_year INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        console_id INTEGER,
        year_played INTEGER,
        completed BOOLEAN DEFAULT 0,
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (console_id) REFERENCES consoles(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_games_console_id ON games(console_id);
      CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
      CREATE INDEX IF NOT EXISTS idx_games_completed ON games(completed);
      CREATE TABLE IF NOT EXISTS game_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igdb_id INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        console_name TEXT,
        cover_url TEXT,
        rating REAL,
        release_date INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_catalog_title ON game_catalog(title);
      CREATE INDEX IF NOT EXISTS idx_catalog_console ON game_catalog(console_name);
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await new Promise((resolve, reject) => {
      this.db.exec(schemaSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE consoles ADD COLUMN launch_year INTEGER", (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE games ADD COLUMN month_played INTEGER", (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE games ADD COLUMN year_completed INTEGER", (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE games ADD COLUMN month_completed INTEGER", (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE games ADD COLUMN hours_played REAL", (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE games ADD COLUMN release_year INTEGER", (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE consoles ADD COLUMN image TEXT", (err) => {
        resolve();
      });
    });

    await new Promise((resolve) => {
      this.db.run("ALTER TABLE consoles ADD COLUMN image_type TEXT", (err) => {
        resolve();
      });
    });

    const consoles = [
      { name: 'Family Game', launchYear: 1983 },
      { name: 'Super Nintendo', launchYear: 1990 },
      { name: 'Nintendo 64', launchYear: 1996 },
      { name: 'Dreamcast', launchYear: 1998 },
      { name: 'PlayStation 1', launchYear: 1994 },
      { name: 'PlayStation 2', launchYear: 2000 },
      { name: 'GameCube', launchYear: 2001 },
      { name: 'PlayStation 3', launchYear: 2006 },
      { name: 'PlayStation Portable (PSP)', launchYear: 2004 },
      { name: 'Nintendo DS', launchYear: 2004 },
      { name: 'Nintendo Wii', launchYear: 2006 },
      { name: 'PlayStation 4', launchYear: 2013 },
      { name: 'Nintendo Switch', launchYear: 2017 },
      { name: 'PlayStation 5', launchYear: 2020 },
      { name: 'PC', launchYear: 1981 }
    ];

    for (const { name, launchYear } of consoles) {
      await new Promise((resolve, reject) => {
        this.db.run(
          'INSERT OR IGNORE INTO consoles (name) VALUES (?)',
          [name],
          (err) => {
            if (err) logger.error({ err }, 'Error inserting console');
            resolve();
          }
        );
      });
    }
    for (const { name, launchYear } of consoles) {
      await new Promise((resolve, reject) => {
        this.db.run(
          'UPDATE consoles SET launch_year = ? WHERE name = ? AND launch_year IS NULL',
          [launchYear, name],
          (err) => {
            if (err) logger.error({ err }, 'Error updating console launch_year');
            resolve();
          }
        );
      });
    }

    this.initialized = true;
    logger.info('SQLite tables initialized');
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows: rows || [] });
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ rows: [{ id: this.lastID }], lastID: this.lastID, changes: this.changes });
        });
      }
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

class PostgreSQLClient {
  constructor() {
    this.pool = null;
  }

  async connect() {
    this.pool = new pg.Pool({
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'games_tracker',
    });

    this.pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle client');
    });

    logger.info({ host: process.env.DB_HOST, port: process.env.DB_PORT }, 'Connected to PostgreSQL');
  }

  async initialize() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS consoles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          launch_year INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          console_id INTEGER REFERENCES consoles(id) ON DELETE SET NULL,
          year_played INTEGER,
          completed BOOLEAN DEFAULT FALSE,
          image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_games_console_id ON games(console_id)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_games_title ON games(title)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_games_completed ON games(completed)`);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS game_catalog (
          id SERIAL PRIMARY KEY,
          igdb_id INTEGER NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          console_name VARCHAR(255),
          cover_url TEXT,
          rating NUMERIC(5,2),
          release_date INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_title ON game_catalog(title)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_catalog_console ON game_catalog(console_name)`);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.pool.query(`ALTER TABLE consoles ADD COLUMN IF NOT EXISTS launch_year INTEGER`);

      await this.pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS month_played INTEGER`);
      await this.pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS year_completed INTEGER`);
      await this.pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS month_completed INTEGER`);
      await this.pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS hours_played NUMERIC(8,1)`);
      await this.pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS release_year INTEGER`);

      await this.pool.query(`ALTER TABLE consoles ADD COLUMN IF NOT EXISTS image TEXT`);
      await this.pool.query(`ALTER TABLE consoles ADD COLUMN IF NOT EXISTS image_type VARCHAR(20) DEFAULT 'bitmap'`);

      await this.pool.query(`DROP VIEW IF EXISTS games_view CASCADE`);

      await this.pool.query(`CREATE VIEW games_view AS
        SELECT
            g.id, g.title,
            g.year_played, g.month_played,
            g.year_completed, g.month_completed,
            g.hours_played,
            g.completed, g.image,
            c.name as console_name, c.id as console_id,
            g.created_at, g.updated_at,
            g.release_year
        FROM games g
        LEFT JOIN consoles c ON g.console_id = c.id
        ORDER BY g.created_at DESC
      `);

      const pgSeed = [
        { name: 'Family Game', launchYear: 1983 },
        { name: 'Super Nintendo', launchYear: 1990 },
        { name: 'Nintendo 64', launchYear: 1996 },
        { name: 'Dreamcast', launchYear: 1998 },
        { name: 'PlayStation 1', launchYear: 1994 },
        { name: 'PlayStation 2', launchYear: 2000 },
        { name: 'GameCube', launchYear: 2001 },
        { name: 'PlayStation 3', launchYear: 2006 },
        { name: 'PlayStation Portable (PSP)', launchYear: 2004 },
        { name: 'Nintendo DS', launchYear: 2004 },
        { name: 'Nintendo Wii', launchYear: 2006 },
        { name: 'PlayStation 4', launchYear: 2013 },
        { name: 'Nintendo Switch', launchYear: 2017 },
        { name: 'PlayStation 5', launchYear: 2020 },
        { name: 'PC', launchYear: 1981 }
      ];
      for (const { name, launchYear } of pgSeed) {
        await this.pool.query(
          'INSERT INTO consoles (name, launch_year) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET launch_year = COALESCE(consoles.launch_year, $2)',
          [name, launchYear]
        );
      }

      await this.pool.query(`
        CREATE OR REPLACE VIEW games_view AS
        SELECT
            g.id, g.title,
            g.year_played, g.month_played,
            g.year_completed, g.month_completed,
            g.hours_played,
            g.completed, g.image,
            c.name as console_name, c.id as console_id,
            g.created_at, g.updated_at,
            g.release_year
        FROM games g
        LEFT JOIN consoles c ON g.console_id = c.id
        ORDER BY g.created_at DESC
      `);

      logger.info('PostgreSQL tables initialized');
    } catch (error) {
      logger.error({ err: error }, 'Error initializing PostgreSQL');
      throw error;
    }
  }

  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export async function initializeDatabase() {
  if (DB_TYPE === 'postgresql' || DB_TYPE === 'postgres') {
    client = new PostgreSQLClient();
  } else {
    client = new SQLiteClient();
  }

  await client.connect();
  await client.initialize();

  logger.info({ dbType: DB_TYPE.toUpperCase() }, 'Database ready');
  return client;
}

export function getDatabase() {
  if (!client) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return client;
}

export async function closeDatabase() {
  if (client) {
    await client.close();
  }
}

export { DB_TYPE };
