## 📂 Estructura del Proyecto

```
games-tracker-backend/
├── _legacy/                     # Archivos legacy (backup)
│   ├── server.js
│   ├── server-postgres.js
│   ├── init_script.sql
│   └── games copy.db
├── db/
│   ├── database.js              # Driver unificado (SQLite/PostgreSQL)
│   ├── logger.js                # Logger estructurado (pino)
│   └── migrate.js               # Runner de migraciones SQL
├── migrations/
│   ├── 001_initial.sql          # Schema inicial
│   └── 002_catalog_view.sql     # Vista games_view
├── scripts/
│   └── seed-catalog.js          # Pobla game_catalog desde IGDB
├── tests/
│   └── api.test.js              # Tests (node:test + supertest)
├── docs/                        # Documentación modular (1 carpeta por sección)
├── games.db                     # BD SQLite (local, auto-generada)
├── init.sql                     # Schema PostgreSQL + seed (docker-entrypoint)
├── server-unified.js            # 🚀 Servidor principal (dual DB)
├── package.json                 # Dependencias y scripts (npm/pnpm)
├── .env                         # Variables de entorno (local, no commitear)
├── .env.example                 # Plantilla de variables
├── .dockerignore                # Exclusiones para Docker build
├── docker-compose.yml           # Orquestación Docker (PostgreSQL + backend)
├── Dockerfile                   # Imagen Docker (backend)
├── AGENTS.md                    # Índice de documentación modular
├── DOCKER.md                    # Guía Docker
└── README.md                    # README principal
```
