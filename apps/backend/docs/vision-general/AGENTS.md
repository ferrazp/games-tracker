## 🎯 Visión General

Backend de **Games Tracker**, registro personal de videojuegos jugados. Es el workspace `games-backend` del monorepo `ferrazp/games-tracker`; el frontend está en [`apps/frontend`](../../../frontend/AGENTS.md).

Qué resuelve:

- **Registro de juegos** por consola, con fechas, horas y estado (completado o pendiente).
- **Catálogo** precargado desde IGDB (~7800 juegos) y búsqueda en vivo en IGDB para cargar rápido.
- **Próximos juegos** (wishlist) ordenables.
- **Sagas** (desde v1.8.0): agrupa los juegos registrados por las series de IGDB, muestra los que faltan y dónde jugarlos, y permite archivar juegos y unir versiones que el usuario considera el mismo juego.

| Ambiente | BD | Cómo se levanta | Web |
|----------|----|-----------------|-----|
| **Dev** | SQLite (`apps/backend/games.db`) | `npm run dev` | API `:4000`, front `:3000` |
| **QA** | PostgreSQL 17 propio (`gt-qa`) | `npm run qa:up -- --tag …` | `:8081` (API en `/api`) |
| **Prod** | PostgreSQL 17 propio (`gt-prod`) | `npm run prod:deploy -- X.Y.Z` | `:8090` (API en `/api`) |

Ver [OPERACION.md](../../../../docs/OPERACION.md) y [Perfiles de Ambiente](../perfiles-ambiente/AGENTS.md).
