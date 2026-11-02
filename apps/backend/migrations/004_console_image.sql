-- 004_console_image.sql
-- Agrega columna image (Base64) a la tabla consoles
-- Tanto para SQLite como PostgreSQL

-- SQLite:
ALTER TABLE consoles ADD COLUMN image TEXT;

-- PostgreSQL (ejecutar manualmente si aplica):
-- ALTER TABLE consoles ADD COLUMN IF NOT EXISTS image TEXT;
