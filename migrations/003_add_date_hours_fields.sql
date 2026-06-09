-- 003_add_date_hours_fields.sql
-- Agrega columnas de mes jugado, fecha completado y horas jugadas
-- Tanto para SQLite como PostgreSQL

-- SQLite:
ALTER TABLE games ADD COLUMN month_played INTEGER;
ALTER TABLE games ADD COLUMN year_completed INTEGER;
ALTER TABLE games ADD COLUMN month_completed INTEGER;
ALTER TABLE games ADD COLUMN hours_played REAL;

-- PostgreSQL (ejecutar manualmente si aplica):
-- ALTER TABLE games ADD COLUMN IF NOT EXISTS month_played INTEGER;
-- ALTER TABLE games ADD COLUMN IF NOT EXISTS year_completed INTEGER;
-- ALTER TABLE games ADD COLUMN IF NOT EXISTS month_completed INTEGER;
-- ALTER TABLE games ADD COLUMN IF NOT EXISTS hours_played NUMERIC(8,1);
-- CREATE OR REPLACE VIEW games_view AS ... (ver init.sql actualizado)
