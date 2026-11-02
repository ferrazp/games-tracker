## 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| Tablas BD | 3 (consoles, games, game_catalog) |
| Vistas BD | 1 (games_view en PostgreSQL) |
| Índices | 6 (3 games + 3 game_catalog) |
| Índices parciales | 1 (idx_catalog_console_cover) |
| Foreign Keys | 1 (games.console_id → consoles.id) |
| Consolas predefinidas | 17 (15 originales + Game Boy Color, Xbox 360) |
| Catálogo IGDB | ~7,800 juegos (top 1000 por consola) |
| Endpoints API | 10 |
| Lenguaje | JavaScript (Node.js ES6+) |
| BD Soportadas | 2 (SQLite + PostgreSQL) |
| Perfiles Docker | 2 (dev + prod) |
| Package Managers | 2 (npm + pnpm) |
