-- 001_initial.sql
-- Schema inicial del proyecto

CREATE TABLE IF NOT EXISTS consoles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    console_id INTEGER,
    year_played INTEGER,
    month_played INTEGER,
    year_completed INTEGER,
    month_completed INTEGER,
    hours_played REAL,
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
