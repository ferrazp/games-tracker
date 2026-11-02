> ⚠️ **Obsoleto desde v1.5.0.** Los `docker-compose*.yml` y `nginx.prod.conf` de este backend se eliminaron. QA y Prod se levantan con `deploy/compose.yaml` y los scripts del monorepo: ver [`docs/OPERACION.md`](../../../../docs/OPERACION.md).

## 🎯 Visión General

Este es el **backend** del proyecto Games Tracker, un gestor personal de videojuegos jugados. Soporta **3 perfiles de entorno**:

| Perfil | BD | Docker | Puertos |
|--------|----|--------|---------|
| **Local** | SQLite (`games.db`) | No | API `:4000`, Front `:3000` |
| **Dev Docker** | PostgreSQL (`games_tracker`) | `docker-compose.dev.yml` | API `:4001`, Front `:3001`, DB `:5433` |
| **Prod Docker** | PostgreSQL (`games_tracker_prod`) | `docker-compose.yml` + `docker-compose.prod.yml` | API `:4001`, Front `:9090`, DB `:5432` |

See [🌍 Perfiles de Ambiente](../perfiles-ambiente/AGENTS.md) para detalles.

El frontend se encuentra en: `F:\projects\developments\games-tracker` ([AGENTS.md del frontend](F:\projects\developments\games-tracker\AGENTS.md))
