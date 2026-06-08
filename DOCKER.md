# Manual de Operaciones Docker - Games Tracker

Arquitectura: **3 contenedores**, 1 red, 1 volumen persistente.

```
┌─ Host ────────────────────────────────────┐
│                                            │
│  :3000  ┌─ frontend ──── nginx:1.27 ──┐   │
│  ──────▶│  (React SPA)                │   │
│         └──────────┬───────────────────┘   │
│                    │ proxy /games          │
│                    │ /consoles /search     │
│                    ▼                       │
│  :4000  ┌─ backend ──── node:20 ───────┐   │
│  ──────▶│  (Express API)               │   │
│         └──────────┬───────────────────┘   │
│                    │ DB connection         │
│                    ▼                       │
│         ┌─ postgres ──── postgres:17 ──┐   │
│         │  (volumen: postgres_data)     │   │
│         └───────────────────────────────┘   │
└────────────────────────────────────────────┘
```

---

## 📋 Índice

1. [Requisitos](#requisitos)
2. [Primer Despliegue](#primer-despliegue)
3. [Comandos de Mantenimiento](#comandos-de-mantenimiento)
4. [Monitoreo y Logs](#monitoreo-y-logs)
5. [Backup y Restore de la BD](#backup-y-restore-de-la-bd)
6. [Actualización de Imágenes](#actualización-de-imágenes)
7. [Escenarios de Recuperación](#escenarios-de-recuperación)
8. [Arquitectura de Red](#arquitectura-de-red)

---

## Requisitos

```powershell
docker --version          # ≥ 24
docker compose version    # plugin v2
wsl -l -v                 # Ubuntu Running v2
```

## Primer Despliegue

```powershell
cd F:\projects\developments\games-tracker-backend

# 1. Crear .env (si no existe)
cp .env.example .env

# 2. Build imágenes y levantar servicios
docker compose up -d --build

# 3. Esperar health checks (15-30s)
docker compose ps
# Todos deben mostrar "(healthy)"

# 4. Verificar
curl http://localhost:4000/health
curl http://localhost:4000/consoles
curl http://localhost:3000
```

## Comandos de Mantenimiento

### Ciclo de Vida de los Servicios

```powershell
# Levantar todo
docker compose up -d

# Ver estado
docker compose ps

# Reiniciar un servicio específico
docker compose restart backend
docker compose restart frontend
docker compose restart postgres

# Detener (mantiene datos y redes)
docker compose stop

# Reanudar tras stop
docker compose start

# Eliminar contenedores (mantiene volúmenes)
docker compose down

# Eliminar TODO (incluye datos de BD)
docker compose down -v
```

### Migraciones

```powershell
# Aplicar migraciones pendientes al contenedor corriendo
docker compose exec backend node db/migrate.js

# También via npm script
docker compose exec backend npm run migrate
```

### Rebuild Después de Cambios

```powershell
# Solo backend (tras cambiar server-unified.js)
docker compose build backend
docker compose up -d

# Solo frontend (tras cambiar src/)
docker compose build frontend
docker compose up -d

# Ambos
docker compose up -d --build

# Sin cache (build limpio)
docker compose build --no-cache backend
```

### Logs

```powershell
# Todos los servicios en tiempo real
docker compose logs -f

# Servicio específico
docker compose logs backend
docker compose logs -f frontend

# Últimas N líneas
docker compose logs --tail=50 backend

# Desde una fecha
docker compose logs --since="2026-06-07" backend
```

## Monitoreo y Health Checks

Cada contenedor tiene healthcheck automático cada 30s:

```powershell
# Ver health status
docker compose ps

# Inspeccionar health de un contenedor
docker inspect games_tracker_backend --format '{{.State.Health.Status}}'

# Ver últimos health checks
docker inspect games_tracker_db --format '{{json .State.Health}}' | ConvertFrom-Json
```

## Backup y Restore de la BD

### Backup

```powershell
# Backup completo
docker exec games_tracker_db pg_dump -U postgres games_tracker > backup_$(Get-Date -Format yyyyMMdd).sql

# Backup solo schema
docker exec games_tracker_db pg_dump -U postgres --schema-only games_tracker > schema.sql

# Backup solo datos
docker exec games_tracker_db pg_dump -U postgres --data-only games_tracker > data.sql
```

### Restore

```powershell
# Opción 1: Restaurar en contenedor corriendo
Get-Content backup.sql | docker exec -i games_tracker_db psql -U postgres games_tracker

# Opción 2: Reset completo + restore
docker compose down -v
docker compose up -d
# Esperar a que postgres esté healthy, luego:
Get-Content backup.sql | docker exec -i games_tracker_db psql -U postgres games_tracker

# Opción 3: Montar backup en init (para nuevo deploy)
Copy-Item backup.sql init.sql
docker compose up -d --build
```

### Backup Automático (Script)

```powershell
# scripts/backup-db.ps1
$date = Get-Date -Format yyyyMMdd-HHmmss
$file = "backups/backup-$date.sql"
New-Item -ItemType Directory -Force -Path backups | Out-Null
docker exec games_tracker_db pg_dump -U postgres games_tracker > $file
Write-Host "Backup saved: $file"
```

## Actualización de Imágenes

### PostgreSQL (ej: 17 → 18)

```powershell
# 1. Backup de datos
docker exec games_tracker_db pg_dump -U postgres games_tracker > pre_upgrade_backup.sql

# 2. Bajar y eliminar volumen (datos viejos no compatibles)
docker compose down -v

# 3. Cambiar tag en docker-compose.yml
#    image: postgres:18-alpine

# 4. Rebuild y levantar
docker compose up -d

# 5. Restaurar datos
Get-Content pre_upgrade_backup.sql | docker exec -i games_tracker_db psql -U postgres games_tracker
```

### Node (backend) o Nginx (frontend)

```powershell
# 1. Cambiar tag en Dockerfile respectivo
# 2. Rebuild y levantar
docker compose build backend
docker compose up -d

# Verificar
docker compose logs backend --tail=5
```

## Escenarios de Recuperación

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `backend` no healthy | Error de conexión a BD | `docker compose logs backend` y `docker compose logs postgres` |
| `postgres` no healthy | Puerto ocupado o volumen corrupto | `docker compose down -v && docker compose up -d` |
| `frontend` 404 en API | Nginx proxy mal configurado | Verificar `proxy_pass http://backend:4000` en nginx.conf |
| Frontend carga pero no datos | CORS | Verificar `FRONTEND_URL` en `.env` del backend |
| Puerto 5432 ocupado en host | Otro PostgreSQL local | Cambiar `DB_PORT` en `.env` (ej: 5433) |
| Backend no responde | Error de Node | `docker compose restart backend` |
| Contenedores no arrancan | WSL integration off | Docker Desktop → Settings → Resources → WSL Integration |
| "no space left" en volumen | Logs o datos crecieron | `docker system prune -af` (limpiar) |
| Error de permisos al buildear | WSL filesystem vs NTFS | Asegurar que los proyectos están en NTFS, no dentro de WSL |

## Arquitectura de Red

### Red interna: `games_network`

Los 3 contenedores se comunican por DNS interno (bridge):

```
postgres:5432    → backend usa este host
backend:4000     → nginx usa este host para proxy
frontend:80      → expuesto como localhost:3000
```

### Puertos expuestos al host

| Servicio | Puerto Host | Puerto Contenedor | Uso |
|----------|-------------|-------------------|-----|
| postgres | 5432 | 5432 | Conexión directa a BD |
| backend | 4000 | 4000 | API directa |
| frontend | 3000 | 80 | App web + proxy API |

Para cambiar puertos, editar `.env`:

```env
API_PORT=4001
FRONTEND_PORT=3001
DB_PORT=5433
```

### Volumen persistente: `postgres_data`

- Tipo: `local` (en disco del host)
- Propósito: mantener datos de BD entre reinicios
- Ruta real: manejada por Docker (`docker volume inspect games-tracker-backend_postgres_data`)
- Backup: usar `pg_dump` (ver sección backup)

## Extra: Desarrollo Sin Docker

```bash
# Solo backend con SQLite
npm run dev:sqlite

# Solo backend con PostgreSQL (necesita postgres corriendo)
npm run dev:postgres

# Frontend standalone
cd ../games-tracker
npm start
```
