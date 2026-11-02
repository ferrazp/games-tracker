-- 006_sagas.sql
-- Documental: el esquema real lo crea initialize() en db/database.js (SQLite y PostgreSQL).
-- Vínculo de cada juego con IGDB y tablas de sagas (series).
-- Tipos mostrados en SQLite; en PostgreSQL DATETIME es TIMESTAMP.

ALTER TABLE games ADD COLUMN igdb_id INTEGER;
ALTER TABLE games ADD COLUMN igdb_match TEXT;       -- 'selected' | 'auto' | 'manual' | 'unresolved' | 'none' | NULL (pendiente)
ALTER TABLE games ADD COLUMN igdb_candidates TEXT;  -- JSON [{igdb_id, name, year, platforms, cover_url}]

CREATE TABLE IF NOT EXISTS igdb_resolution (
    igdb_id INTEGER PRIMARY KEY,
    canonical_igdb_id INTEGER NOT NULL,
    saga_id INTEGER,                                 -- NULL = no está en ninguna serie
    resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sagas (
    id INTEGER PRIMARY KEY,                          -- id de collection IGDB
    name TEXT NOT NULL,
    refreshed_at DATETIME
);

CREATE TABLE IF NOT EXISTS saga_games (
    igdb_id INTEGER PRIMARY KEY,
    saga_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    release_year INTEGER,
    game_type INTEGER,
    cover_url TEXT,
    versions TEXT                                    -- JSON [{label, year}]
);

CREATE INDEX IF NOT EXISTS idx_saga_games_saga_id ON saga_games(saga_id);
