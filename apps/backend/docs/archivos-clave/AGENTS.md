## 📚 Archivos Clave

| Archivo | Propósito |
|---------|----------|
| `server-unified.js` | 🚀 Arranque: Express, middlewares, rutas y jobs de sagas (10 s después de arrancar y cada 24 h) |
| `db/database.js` | 🔌 Driver SQLite/PostgreSQL; `initialize()` crea y actualiza el esquema en cada arranque |
| `src/routes/*.js` | 🌐 Endpoints de la API (ver [API REST](../api-rest/AGENTS.md)) |
| `src/routes/sagas.js` | 🎮 Sagas: lectura, refresco, archivo, versiones unidas y juegos sin identificar |
| `src/services/sagas-logic.js` | 🧠 Lógica pura de sagas: original de cada versión, estados, detalle y sugerencias |
| `src/services/sagas-sync.js` | 🔄 Jobs de sagas: completar IDs de IGDB, resolver originales, refrescar sagas |
| `src/services/igdb-client.js` | 📡 Cliente IGDB por lotes para los jobs |
| `src/services/twitch.js` | 🔑 Token de Twitch para IGDB |
| `migrations/*.sql` | 📋 Documentación del esquema por etapas (el real está en `database.js`) |
| `scripts/seed-catalog.js` | 🎮 Pobla `game_catalog` desde IGDB |
| `scripts/seed-console-images.js` | 🖼️ Imágenes de consolas |
| `Dockerfile` | 🐳 Imagen del backend (GHCR) |
| `../../deploy/compose.yaml` | 🐳 QA y Prod (con `compose.qa.yaml` / `compose.prod.yaml`) |
| `../../docs/OPERACION.md` | 🚢 Deploy, backup, restore, rollback y jobs de sagas |
