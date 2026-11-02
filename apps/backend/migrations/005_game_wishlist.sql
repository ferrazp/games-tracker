-- 005_game_wishlist.sql
-- Tabla para lista de próximos juegos a jugar (wishlist)
-- Tanto para SQLite como PostgreSQL

CREATE TABLE IF NOT EXISTS game_wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_catalog_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_catalog_id) REFERENCES game_catalog(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wishlist_sort_order ON game_wishlist(sort_order);
CREATE INDEX IF NOT EXISTS idx_wishlist_catalog_id ON game_wishlist(game_catalog_id);
