-- 007_saga_archive_links.sql
-- Documental: el esquema real lo crea initialize() en db/database.js (SQLite y PostgreSQL).
-- Decisiones del usuario sobre las sagas. Van aparte de saga_games (caché de IGDB que se
-- reescribe en cada refresco) y sin FK, para que ningún refresco las deshaga.
-- Tipos mostrados en SQLite; en PostgreSQL DATETIME es TIMESTAMP.

-- v1.8.0: juegos archivados (fuera de la grilla y de los totales hasta restaurarlos).
CREATE TABLE IF NOT EXISTS saga_archived (
    igdb_id INTEGER PRIMARY KEY,
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- v1.10.0: versiones unidas (cuentan como jugadas). Una fila por juego del grupo,
-- la principal incluida (apunta a sí misma).
CREATE TABLE IF NOT EXISTS saga_links (
    igdb_id INTEGER PRIMARY KEY,
    main_igdb_id INTEGER NOT NULL
);
