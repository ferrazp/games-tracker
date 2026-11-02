## 🌍 Perfiles de Ambiente

El proyecto soporta **3 entornos** independientes: desarrollo local sin Docker (SQLite), desarrollo Dockerizado (PostgreSQL) y producción Dockerizada (PostgreSQL con base separada).

---

### ⚡ Perfil: Desarrollo Local (SQLite)

| Atributo | Valor |
|----------|-------|
| **Comando** | `npm start` o `npm run dev:sqlite` |
| **Base de Datos** | SQLite (`games.db`) |
| **Puerto API** | 4000 |
| **Puerto Frontend** | 3000 (ejecutado aparte) |
| **Frontend URL (CORS)** | `http://localhost:3000` |
| **Requiere Docker** | No |
| **DB_TYPE** | `sqlite` |

Usar para: desarrollo rápido de features, tests offline, sin dependencias externas.

---

### 🧪 Perfil: Desarrollo Docker (PostgreSQL)

| Atributo | Valor |
|----------|-------|
| **Archivo Compose** | `docker-compose.dev.yml` |
| **Comando** | `docker compose -f docker-compose.dev.yml up -d --build` |
| **Base de Datos** | PostgreSQL `games_tracker` en volumen `postgres_dev_data` |
| **Puerto API** | 4001 |
| **Puerto Frontend** | 3001 |
| **Frontend URL (CORS)** | `http://localhost:3001` |
| **Puerto DB Host** | 5433 |
| **Contenedor DB** | `games_tracker_dev_db` |
| **Contenedor Backend** | `games_tracker_dev_backend` |
| **Contenedor Frontend** | `games_tracker_dev_frontend` |
| **Red Docker** | `games_dev_network` |
| **NODE_ENV** | `development` |

Usar para: testear contra PostgreSQL antes de merge a develop, probar migraciones, verificar compatibilidad.

---

### 🚀 Perfil: Producción Docker (PostgreSQL)

| Atributo | Valor |
|----------|-------|
| **Archivos Compose** | `docker-compose.yml` (base) + `docker-compose.prod.yml` (override) |
| **Comando** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` |
| **Base de Datos** | PostgreSQL `games_tracker_prod` en volumen `postgres_data` |
| **Puerto API** | 4001 |
| **Puerto Frontend** | 9090 |
| **Frontend URL (CORS)** | `http://localhost:9090` |
| **Puerto DB Host** | 5432 |
| **Contenedor DB** | `games_tracker_db` |
| **Contenedor Backend** | `games_tracker_backend_prod` |
| **Contenedor Frontend** | `games_tracker_frontend_prod` |
| **Red Docker** | `games_network` |
| **NODE_ENV** | `production` |

Usar para: acceso público, demo, uso familiar, cualquier escenario donde quieras el frontend en `http://localhost:9090`.

---

### 🏗️ Arquitectura de Contenedores

```
┌─ Desarrollo (docker-compose.dev.yml) ──────────────────────┐
│                                                             │
│  :3001  ┌─ games_tracker_dev_frontend ── nginx:1.27 ──┐    │
│  ──────▶│  (VITE_API_URL: http://localhost:4001)       │    │
│         └──────────────────┬───────────────────────────┘    │
│                            │ proxy /games/consoles/search   │
│                            ▼                                │
│  :4001  ┌─ games_tracker_dev_backend ── node:20 ────────┐   │
│  ──────▶│  (NODE_ENV=development, DB=games_tracker)      │   │
│         └──────────────────┬─────────────────────────────┘   │
│                            │ DB connection                   │
│                            ▼                                 │
│  :5433  ┌─ games_tracker_dev_db ── postgres:17 ─────────┐   │
│         │  (volumen: postgres_dev_data)                   │   │
│         └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─ Producción (docker-compose.yml + docker-compose.prod.yml) ─┐
│                                                               │
│  :9090  ┌─ games_tracker_frontend_prod ── nginx:1.27 ─────┐  │
│  ──────▶│  (VITE_API_URL: http://localhost:4001)          │  │
│         └──────────────────┬───────────────────────────────┘  │
│                            │ proxy /games/consoles/search     │
│                            ▼                                  │
│  :4001  ┌─ games_tracker_backend_prod ── node:20 ─────────┐  │
│  ──────▶│  (NODE_ENV=production, DB=games_tracker_prod)   │  │
│         └──────────────────┬───────────────────────────────┘  │
│                            │ DB connection                    │
│                            ▼                                  │
│  :5432  ┌─ games_tracker_db ── postgres:17 ──────────────┐  │
│         │  (volumen: postgres_data, DB: games_tracker    │  │
│         │   + games_tracker_prod)                        │  │
│         └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Nota:** Ambos perfiles comparten el mismo `init.sql` (seed de consolas + schema). La diferencia está en el nombre de la base de datos (`games_tracker` vs `games_tracker_prod`) y los puertos expuestos.

---

### 📋 Tabla Comparativa

| Aspecto | Local SQLite | Dev Docker | Prod Docker |
|---------|:-----------:|:----------:|:-----------:|
| Archivo BD | `games.db` | `postgres_dev_data` | `postgres_data` |
| DB_NAME | — | `games_tracker` | `games_tracker_prod` |
| API URL | `:4000` | `:4001` | `:4001` |
| Frontend URL | `:3000` | `:3001` | `:9090` |
| CORS | `localhost:3000` | `localhost:3001` | `localhost:9090` |
| Docker Requerido | No | Sí | Sí |
| DB_PORT host | — | `5433` | `5432` |
| NODE_ENV | `development` | `development` | `production` |
| Contenedores | 0 | 3 | 5 (incluye base) |

---

### ⚠️ Reglas Importantes

1. **Nunca mezclar volúmenes**: `postgres_data` (prod) y `postgres_dev_data` (dev) son independientes. El primero persiste la BD de producción, el segundo la de desarrollo.
2. **Puertos diferenciados**: Dev usa 3001/4001/5433, Prod usa 9090/4001/5432. El backend comparte puerto 4001 en ambos perfiles pero **nunca corren juntos** (se elige uno u otro compose).
3. **Base separada**: `games_tracker` es para desarrollo, `games_tracker_prod` para producción. Aunque estén en el mismo contenedor PostgreSQL, los datos están aislados.
4. **init.sql se aplica a ambas**: El schema y seed de consolas se ejecuta en cada base al crearse.
5. **Docker compose base** (`docker-compose.yml`) contiene servicios para producción (postgres + backend + frontend). No levantar sin el override prod si querés producción.
