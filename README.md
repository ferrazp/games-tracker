# Games Tracker Backend

API REST para tracking personal de videojuegos. Permite gestionar una colección de juegos jugados, con catálogo precargado desde IGDB, soporte multi-plataforma y validación contextual (año jugado vs año de lanzamiento de consola).

## Stack

- **Runtime:** Node.js 20
- **Framework:** Express
- **Base de datos:** PostgreSQL 17 (Docker) / SQLite (desarrollo local)
- **Catálogo:** IGDB API (Twitch) — +7800 juegos precargados
- **Autenticación:** JWT (admin local)
- **Deploy:** Docker Compose (3 perfiles: local, dev Docker, prod Docker)

## Perfiles de Entorno

| Perfil | Comando | API | Frontend | DB |
|--------|---------|-----|----------|----|
| **Local** (SQLite) | `npm start` | `:4000` | `:3000` | `games.db` |
| **Dev Docker** | `docker compose -f docker-compose.dev.yml up -d` | `:4001` | `:3001` | PostgreSQL `games_tracker` (puerto `5433`) |
| **Prod Docker** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` | `:4001` | `:9090` | PostgreSQL `games_tracker_prod` (puerto `5432`) |

## Quick Start

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
curl http://localhost:4001/health
curl http://localhost:9090
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
| Game Boy Color | 1998 |
| Xbox 360 | 2005 |

## Documentación

Ver [`AGENTS.md`](./AGENTS.md) para documentación detallada de arquitectura, setup y operaciones.
