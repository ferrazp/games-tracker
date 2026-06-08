# Games Tracker Backend

API REST para tracking personal de videojuegos. Permite gestionar una colección de juegos jugados, con catálogo precargado desde IGDB, soporte multi-plataforma y validación contextual (año jugado vs año de lanzamiento de consola).

## Stack

- **Runtime:** Node.js 20
- **Framework:** Express
- **Base de datos:** PostgreSQL 17 (producción) / SQLite (desarrollo)
- **Catálogo:** IGDB API (Twitch) — +7800 juegos precargados
- **Autenticación:** JWT (admin local)
- **Deploy:** Docker Compose (3 contenedores: PostgreSQL + Backend + Frontend)

## Features

- Catálogo de juegos con covers, rating y fecha de lanzamiento
- CRUD completo de juegos con asignación por consola
- Validación año jugado: no puede ser anterior al lanzamiento de la consola
- Búsqueda local y online (IGDB) con selección de consola
- Soporte dual SQLite/PostgreSQL sin cambiar código
- Imágenes en base64 embebidas en DB (sin dependencia de CDN)
- Seed de hasta 1000 juegos mejor rankeados por plataforma

## Quick Start

```bash
cp .env.example .env
docker compose up -d
curl http://localhost:4000/health
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /consoles | Lista de consolas (con launch_year) |
| POST | /auth/login | Login admin |
| GET | /games | Listar juegos (paginado, filtros) |
| POST | /games | Agregar juego |
| PUT | /games/:id | Actualizar juego |
| DELETE | /games/:id | Eliminar juego |
| POST | /search | Buscar en catálogo (local + IGDB) |

## Consolas

| Consola | Lanzamiento |
|---------|------------|
| Family Game | 1983 |
| Super Nintendo | 1990 |
| Nintendo 64 | 1996 |
| Dreamcast | 1998 |
| PlayStation 1 | 1994 |
| PlayStation 2 | 2000 |
| GameCube | 2001 |
| PlayStation 3 | 2006 |
| PSP | 2004 |
| Nintendo DS | 2004 |
| Nintendo Wii | 2006 |
| PlayStation 4 | 2013 |
| Nintendo Switch | 2017 |
| PlayStation 5 | 2020 |
| PC | 1981 |

## Estructura

```
├── server-unified.js        Servidor Express
├── db/database.js           Conexión dual SQLite/PostgreSQL
├── scripts/
│   ├── seed-catalog.js      Precarga desde IGDB
│   └── cleanup-catalog.js   Mantenimiento
├── tests/api.test.js        Tests de API
├── init.sql                 Schema PostgreSQL
├── docker-compose.yml       Servicios
└── .env.example             Configuración
```

## Documentación

Ver [`AGENTS.md`](./AGENTS.md) para documentación detallada de arquitectura, setup y operaciones.
