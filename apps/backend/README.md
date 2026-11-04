# Games Tracker Backend

API REST para tracking personal de videojuegos. Permite gestionar una colección de juegos jugados, con catálogo precargado desde IGDB, soporte multi-plataforma, validación contextual (año jugado vs año de lanzamiento de consola) y **sagas** armadas con las series de IGDB.

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

JWT = requiere sesión (`Authorization: Bearer …`). Detalle de cada endpoint: [`docs/api-rest/AGENTS.md`](docs/api-rest/AGENTS.md).

| Método | Ruta | Sesión | Descripción |
|--------|------|--------|-------------|
| GET | /health, /version | — | Estado y versión |
| POST | /auth/login | — | Login admin |
| GET / POST | /consoles | — / JWT | Consolas (con `launch_year`) |
| GET | /games, /games/:id | — | Listar (paginado, filtros) y ver juegos |
| POST / PUT / DELETE | /games, /games/:id | JWT | Agregar, editar y borrar juegos |
| PUT | /games/:id/igdb | JWT | Elegir el juego de IGDB de un juego ambiguo |
| POST | /search | — | Buscar en el catálogo local |
| POST | /search/online | JWT | Buscar en IGDB en vivo |
| GET / POST / PUT / DELETE | /wishlist… | JWT | Próximos juegos (listar, agregar, reordenar, borrar) |
| GET | /stats | JWT | Estadísticas |
| GET / POST | /export, /import | JWT | Exportar e importar los datos |
| GET | /covers/random | — | Portadas para los paneles laterales |
| GET | /sagas, /sagas/:id | — | Sagas y detalle de una saga |
| GET | /sagas/games/:igdbId/suggest | — | Dónde jugar un juego faltante |
| GET | /sagas/unresolved | JWT | Juegos sin identificar |
| POST | /sagas/:id/refresh | JWT | Actualizar una saga desde IGDB |
| PUT / DELETE | /sagas/games/:igdbId/archive | JWT | Archivar y restaurar un juego de una saga |
| PUT / DELETE | /sagas/:id/links, /sagas/:id/links/:mainId | JWT | Unir y separar versiones de un juego |

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
