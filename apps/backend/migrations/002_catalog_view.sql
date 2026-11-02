-- 002_catalog_view.sql
-- Vista para juegos con información de consola (PostgreSQL)

-- En SQLite se maneja con JOIN en las queries
-- Esta migración solo aplica a PostgreSQL

CREATE OR REPLACE VIEW games_view AS
SELECT
    g.id,
    g.title,
    g.year_played,
    g.completed,
    g.image,
    c.name as console_name,
    c.id as console_id,
    g.created_at,
    g.updated_at
FROM games g
LEFT JOIN consoles c ON g.console_id = c.id
ORDER BY g.created_at DESC;
