## 📂 Estructura del Proyecto

```
games-tracker-backend/
├── _legacy/                     # Archivos legacy (backup)
├── db/
│   ├── database.js              # Driver unificado (SQLite/PostgreSQL)
│   ├── logger.js                # Logger estructurado (pino)
│   └── migrate.js               # Runner de migraciones SQL
├── migrations/
│   ├── 001_initial.sql          # Schema inicial
│   └── 002_catalog_view.sql     # Vista games_view
├── scripts/
│   ├── seed-catalog.js          # Pobla game_catalog desde IGDB
│   └── seed-console-images.js   # Seed imágenes de consolas
├── tests/
│   └── api.test.js              # Tests (node:test + supertest)
├── docs/                        # Documentación modular (1 carpeta por sección)
│   └── perfiles-ambiente/       # 🌍 Perfiles dev/prod/local
├── games.db                     # BD SQLite (local, auto-generada)
├── init.sql                     # Schema PostgreSQL + seed (docker-entrypoint)
├── server-unified.js            # 🚀 Servidor principal (dual DB)
├── package.json                 # Dependencias y scripts (npm/pnpm)
├── .env                         # Variables de entorno (local, no commitear)
├── .env.example                 # Plantilla de variables
├── .dockerignore                # Exclusiones para Docker build
├── docker-compose.yml           # Orquestación base (postgres + backend + frontend)
├── docker-compose.dev.yml       # Override para desarrollo Docker
├── docker-compose.prod.yml      # Override para producción Docker
├── nginx.prod.conf              # Nginx config para frontend de producción
├── Dockerfile                   # Imagen Docker (backend)
├── AGENTS.md                    # Índice de documentación modular
├── docs/BACKUP-VOLUMENES.md      # Estrategia de backup volúmenes
├── docs/DOCKER.md                # Guía Docker completa
└── README.md                     # README principal
```
