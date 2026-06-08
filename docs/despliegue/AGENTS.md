## 🚀 Despliegue con Docker

Arquitectura: **3 contenedores separados** (PostgreSQL 17 + Backend Node + Frontend Nginx).

```
games_tracker_db        → PostgreSQL 17 (base de datos)
games_tracker_backend   → Node 20 (API REST en :4000)
games_tracker_frontend  → Nginx 1.27 (React build en :80 → host :3000)
```

### Requisitos

- Docker 24+ con WSL 2 integration activada
- Los proyectos en `F:\projects\developments\games-tracker-backend` y `..\games-tracker`

### 1. Variables de Entorno

```bash
cp .env.example .env
```

Variables relevantes:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DB_TYPE` | `sqlite` | En Docker se forza a `postgresql` |
| `DB_PASSWORD` | `postgres` | Contraseña PostgreSQL |
| `TWITCH_CLIENT_ID` | — | Opcional, para búsqueda online |
| `TWITCH_CLIENT_SECRET` | — | Opcional, para búsqueda online |
| `FRONTEND_URL` | `http://localhost:3000` | CORS |
| `API_PORT` | `4000` | Puerto host del backend |
| `FRONTEND_PORT` | `3000` | Puerto host del frontend |

### 2. Build y Deploy

```bash
# Primer deploy (build + start)
docker compose up -d --build

# Verificar estado
docker compose ps

# Ver logs de un contenedor específico
docker compose logs backend
docker compose logs frontend

# Shell dentro de un contenedor (útil para debug)
docker exec -it games_tracker_backend sh
docker exec -it games_tracker_frontend sh
```

### ⚠️ Reconstrucción parcial: backend + frontend

Ambos contenedores tienen su propio `COPY` durante el build. Si modificás:

| Cambio | Contenedor a rebuild |
|--------|---------------------|
| `server-unified.js` | `backend` |
| `db/*.js` | `backend` |
| `src/*` (frontend React) | `frontend` |
| `.env` / `docker-compose.yml` | Ambos |

```bash
# Solo backend
docker compose build backend && docker compose up -d backend

# Solo frontend
docker compose build frontend && docker compose up -d frontend

# Ambos (siempre seguro)
docker compose build && docker compose up -d
```

> **Regla:** si tocás el backend, siempre rebuild `backend`. Si tocás el frontend, siempre rebuild `frontend`. Si tocás archivos compartidos o no estás seguro, rebuild ambos.

### 4. Verificar

```bash
# Health check backend
curl http://localhost:4000/health

# Consolas pre-cargadas
curl http://localhost:4000/consoles

# Frontend (sirve HTML)
curl http://localhost:3000

# Nginx proxy API (todo pasa por frontend)
curl http://localhost:3000/games
```
