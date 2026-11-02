# Games Tracker Backend

API REST para tracking personal de videojuegos. Permite gestionar una colección de juegos jugados, con catálogo precargado desde IGDB, soporte multi-plataforma y validación contextual (año jugado vs año de lanzamiento de consola).

## Stack

- **Runtime:** Node.js 26
- **Framework:** Express
- **Base de datos:** PostgreSQL 17 (QA/Prod en Docker) / SQLite (desarrollo local)
- **Catálogo:** IGDB API (Twitch) — +7800 juegos precargados
- **Autenticación:** JWT (admin local)
- **Deploy:** imágenes en GHCR y Docker Compose, con QA y Prod aislados (ver `docs/OPERACION.md` en la raíz)

## Ambientes

| Ambiente | Cómo se levanta (desde la raíz del monorepo) | Front | API | BD |
|---|---|---|---|---|
| **Dev** | `npm run dev` | `:3000` | `:4000` | SQLite `apps/backend/games.db` |
| **QA** | `npm run qa:up` | `:8081` | `/api` | Postgres propio (`gt-qa`) |
| **Prod** | `npm run prod:deploy -- X.Y.Z` | `:8090` | `/api` | Postgres propio (`gt-prod`) |

## Quick Start (dev)

```bash
cp apps/backend/.env.example apps/backend/.env
npm install
npm run dev
curl http://localhost:4000/health
```

QA, Prod, backups y rollback: [`docs/OPERACION.md`](../../docs/OPERACION.md).

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
