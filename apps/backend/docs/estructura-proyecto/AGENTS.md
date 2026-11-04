## 📂 Estructura del Proyecto

Workspace `games-backend` del monorepo (`apps/backend`). La estructura general del repo está en el [AGENTS.md raíz](../../../../AGENTS.md); QA y Prod se levantan con `deploy/` (ver [OPERACION.md](../../../../docs/OPERACION.md)).

```
apps/backend/
├── server-unified.js            # 🚀 Arranque: Express, middlewares, rutas y jobs de sagas
├── db/
│   ├── database.js              # Driver SQLite/PostgreSQL + initialize() (crea el esquema)
│   ├── logger.js                # Logger estructurado (pino)
│   └── migrate.js               # Runner de migraciones SQL (legado)
├── src/
│   ├── config.js                # Configuración desde variables de entorno
│   ├── middleware/              # auth.js (JWT), error-handler.js
│   ├── validators/              # game.js, search.js
│   ├── routes/
│   │   ├── auth.js  health.js  consoles.js  games.js  search.js
│   │   ├── wishlist.js  stats.js  covers.js
│   │   └── sagas.js             # Sagas: lectura, refresco, archivo, versiones unidas, sin identificar
│   ├── services/
│   │   ├── twitch.js            # Token OAuth de Twitch para IGDB
│   │   ├── igdb.js              # Mapa de plataformas IGDB → consolas (búsqueda)
│   │   ├── igdb-client.js       # Cliente IGDB por lotes (500) para los jobs de sagas
│   │   ├── sagas-logic.js       # Lógica pura de sagas (sin BD): original, estados, detalle, sugerencias
│   │   └── sagas-sync.js        # Jobs de sagas: backfill de IDs, resolución, refresco
│   └── svgs/                    # Generador de imágenes SVG de consolas
├── migrations/                  # 001…007: documentales (el esquema real está en database.js)
├── scripts/                     # seed-catalog, seed-console-images, cleanup-catalog, check-igdb
├── tests/
│   ├── unit/                    # node:test, sin BD
│   └── integration/             # supertest contra un SQLite temporal (routes/, services/)
├── docs/                        # Documentación modular (una carpeta por sección)
├── init.sql                     # Esquema PostgreSQL base (referencia)
├── Dockerfile                   # Imagen publicada en GHCR (se construye desde la raíz)
└── package.json
```

### Capas de las sagas

```
routes/sagas.js ──> services/sagas-logic.js   (cálculo, sin BD ni red)
       │
       └──────────> services/sagas-sync.js ──> services/igdb-client.js ──> IGDB
                           │
                           └──> tablas igdb_resolution, sagas, saga_games (caché)
```

- Las pantallas leen solo la base; nunca llaman a IGDB en vivo (salvo *Actualizar* una saga, con sesión).
- `sagas-sync.js` corre 10 s después de arrancar, cada 24 h y en segundo plano al crear o editar un juego; nunca dos corridas a la vez.
- Las rutas que modifican usan `requireJWT` y `sessionLimiter` (60 pedidos por minuto).
- Tablas y motivos: [Esquema de Base de Datos](../esquema-base-datos/AGENTS.md#sagas).
