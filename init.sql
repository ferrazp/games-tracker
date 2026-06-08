-- Inicialización de la base de datos Games Tracker

-- Crear tabla de consolas
CREATE TABLE IF NOT EXISTS consoles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    launch_year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de juegos
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    console_id INTEGER REFERENCES consoles(id) ON DELETE SET NULL,
    year_played INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de catálogo de juegos (precargado desde IGDB)
CREATE TABLE IF NOT EXISTS game_catalog (
    id SERIAL PRIMARY KEY,
    igdb_id INTEGER NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    console_name VARCHAR(255),
    cover_url TEXT,
    rating NUMERIC(5,2),
    release_date INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejora de performance
CREATE INDEX IF NOT EXISTS idx_games_console_id ON games(console_id);
CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
CREATE INDEX IF NOT EXISTS idx_games_completed ON games(completed);

-- Índices para catálogo
CREATE INDEX IF NOT EXISTS idx_catalog_title ON game_catalog(title);
CREATE INDEX IF NOT EXISTS idx_catalog_console ON game_catalog(console_name);

-- Insertar consolas en orden de salida
INSERT INTO consoles (name, launch_year) VALUES
    ('Family Game', 1983),
    ('Super Nintendo', 1990),
    ('Nintendo 64', 1996),
    ('Dreamcast', 1998),
    ('PlayStation 1', 1994),
    ('PlayStation 2', 2000),
    ('GameCube', 2001),
    ('PlayStation 3', 2006),
    ('PlayStation Portable (PSP)', 2004),
    ('Nintendo DS', 2004),
    ('Nintendo Wii', 2006),
    ('PlayStation 4', 2013),
    ('Nintendo Switch', 2017),
    ('PlayStation 5', 2020),
    ('PC', 1981)
ON CONFLICT (name) DO UPDATE SET launch_year = EXCLUDED.launch_year;

-- Crear vista para obtener juegos con información de consola
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
