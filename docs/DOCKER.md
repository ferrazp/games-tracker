# Manual de Operaciones Docker - Games Tracker

## Perfiles de Entorno

El proyecto expone **3 perfiles de entorno**, cada uno con su propio archivo compose o combinación:

| Perfil | Comando | Archivo(s) | Uso |
|--------|---------|-----------|-----|
| 🧪 **Dev** | `docker compose -f docker-compose.dev.yml up -d` | `docker-compose.dev.yml` | Desarrollo + testing contra PostgreSQL |
| 🚀 **Prod** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` | `docker-compose.yml` + `docker-compose.prod.yml` | Producción pública |
| ⚡ **Base standalone** | `docker compose up -d` | `docker-compose.yml` | Solo servicios base (postgres + backend + frontend) |

> **⚠️ Regla de oro:** No ejecutar dev y prod simultáneamente — comparten puertos de contenedor (4001). Elegir UN perfil por sesión.

See [🌍 Perfiles de Ambiente](./perfiles-ambiente/AGENTS.md) para tabla comparativa detallada.

---

## 📋 Índice

1. [Requisitos](#requisitos)
2. [Primer Despliegue - Producción](#primer-despliegue---producción)
3. [Primer Despliegue - Desarrollo](#primer-despliegue---desarrollo)
4. [Comandos de Mantenimiento](#comandos-de-mantenimiento)
5. [Monitoreo y Logs](#monitoreo-y-logs)
6. [Backup y Restore de la BD](#backup-y-restore-de-la-bd)
7. [Actualización de Imágenes](#actualización-de-imágenes)
8. [Escenarios de Recuperación](#escenarios-de-recuperación)
9. [Arquitectura de Red y Puertos](#arquitectura-de-red-y-puertos)

---

## Requisitos

```powershell
docker --version          # ≥ 24
docker compose version    # plugin v2
wsl -l -v                 # Ubuntu Running v2
```

---

## Primer Despliegue - Producción

```powershell
cd F:\projects\developments\games-tracker-backend

# 1. Crear .env (si no existe)
cp .env.example .env

# 2. Build imágenes y levantar servicios
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 3. Esperar health checks (15-30s)
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
# Todos deben mostrar "(healthy)"

# 4. Verificar
curl http://localhost:4001/health
curl http://localhost:4001/consoles
curl http://localhost:9090     # Frontend en puerto 9090

# 5. Seed de datos (opcional)
# Si es la primera vez, seedear imágenes de consolas:
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-prod node scripts/seed-console-images.js
# Y migrar catálogo de juegos desde dev a prod (ver sección Backup)
```

---

## Primer Despliegue - Desarrollo

```powershell
cd F:\projects\developments\games-tracker-backend

# 1. Crear .env (si no existe)
cp .env.example .env

# 2. Build imágenes y levantar servicios
docker compose -f docker-compose.dev.yml up -d --build

# 3. Esperar health checks
docker compose -f docker-compose.dev.yml ps

# 4. Verificar
curl http://localhost:4001/health
curl http://localhost:3001    # Frontend en puerto 3001
```

---

## Comandos de Mantenimiento

### Ciclo de Vida

```powershell
# ── PRODUCCIÓN ──
# Levantar
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Ver estado
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Detener (mantiene datos)
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop

# Reanudar tras stop
docker compose -f docker-compose.yml -f docker-compose.prod.yml start

# Eliminar contenedores (mantiene volúmenes)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Eliminar TODO (incluye datos de BD)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v

# ── DESARROLLO ── (mismos comandos, distinto archivo)
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml down -v
```

### Rebuild Después de Cambios

```powershell
# Solo backend (tras cambiar server-unified.js)
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml up -d

# Solo frontend (tras cambiar src/ en games-tracker)
docker compose -f docker-compose.dev.yml build frontend
docker compose -f docker-compose.dev.yml up -d

# Ambos + rebuild limpio
docker compose -f docker-compose.dev.yml up -d --build

# Para producción, reemplazar el archivo compose:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Logs

```powershell
# Todos los servicios en tiempo real
docker compose -f docker-compose.dev.yml logs -f

# Servicio específico
docker compose -f docker-compose.dev.yml logs backend
docker compose -f docker-compose.prod.yml logs backend-prod

# Últimas N líneas
docker compose logs --tail=50 backend
```

### Migraciones

```powershell
# Producción
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-prod node db/migrate.js

# Desarrollo
docker compose -f docker-compose.dev.yml exec backend node db/migrate.js
```

---

## Monitoreo y Health Checks

Cada contenedor tiene healthcheck automático cada 30s:

```powershell
# Ver health status (todos los servicios activos)
docker compose -f docker-compose.dev.yml ps

# Inspeccionar health de un contenedor específico
docker inspect games_tracker_dev_db --format '{{.State.Health.Status}}'

# Ver últimos health checks
docker inspect games_tracker_dev_db --format '{{json .State.Health}}' | ConvertFrom-Json

# Para producción
docker inspect games_tracker_db --format '{{.State.Health.Status}}'
```

---

## Backup y Restore de la BD

### Backup

```powershell
# ── RESPALDO PRODUCCIÓN (games_tracker_prod) ──
docker exec games_tracker_db pg_dump -U postgres games_tracker_prod > backups/prod_$(Get-Date -Format yyyyMMdd).sql

# ── RESPALDO DESARROLLO (games_tracker) ──
docker exec games_tracker_dev_db pg_dump -U postgres games_tracker > backups/dev_$(Get-Date -Format yyyyMMdd).sql
```

### Restore

```powershell
# ── RESTORE PRODUCCIÓN ──
# Opción 1: Restaurar en contenedor corriendo
Get-Content backups/prod_20260612.sql | docker exec -i games_tracker_db psql -U postgres games_tracker_prod

# Opción 2: Reset completo + restore
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# Esperar a que postgres esté healthy, luego:
Get-Content backups/prod_20260612.sql | docker exec -i games_tracker_db psql -U postgres games_tracker_prod

# ── RESTORE DESARROLLO ──
Get-Content backups/dev_20260612.sql | docker exec -i games_tracker_dev_db psql -U postgres games_tracker
```

### Migrar catálogo de dev a prod

```powershell
# Exportar desde dev
docker exec games_tracker_dev_db psql -U postgres games_tracker -c "\COPY game_catalog TO '/tmp/catalog.csv' CSV HEADER"

# Copiar al host
docker cp games_tracker_dev_db:/tmp/catalog.csv catalog.csv

# Copiar a prod container
docker cp catalog.csv games_tracker_db:/tmp/catalog.csv

# Importar en prod
docker exec games_tracker_db psql -U postgres games_tracker_prod -c "\COPY game_catalog FROM '/tmp/catalog.csv' CSV HEADER"
```

### Backup Automático (Script)

Ver [📦 BACKUP-VOLUMENES.md](./BACKUP-VOLUMENES.md) para script PowerShell y tareas programadas.

---

## Actualización de Imágenes

### PostgreSQL (ej: 17 → 18)

```powershell
# 1. Backup de datos (producción y desarrollo)
docker exec games_tracker_db pg_dump -U postgres games_tracker_prod > pre_upgrade_prod.sql
docker exec games_tracker_dev_db pg_dump -U postgres games_tracker > pre_upgrade_dev.sql

# 2. Bajar y eliminar volúmenes
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
docker compose -f docker-compose.dev.yml down -v

# 3. Cambiar tag en docker-compose.yml y docker-compose.dev.yml
#    image: postgres:18-alpine

# 4. Rebuild y levantar
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Restaurar datos
Get-Content pre_upgrade_prod.sql | docker exec -i games_tracker_db psql -U postgres games_tracker_prod
Get-Content pre_upgrade_dev.sql | docker exec -i games_tracker_dev_db psql -U postgres games_tracker
```

### Node (backend) o Nginx (frontend)

```powershell
# 1. Cambiar tag en Dockerfile respectivo
# 2. Rebuild y levantar
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml up -d

# Verificar
docker compose -f docker-compose.dev.yml logs backend --tail=5
```

---

## Escenarios de Recuperación

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `backend` no healthy | Error de conexión a BD | `docker compose logs backend` y `docker compose logs postgres` |
| `postgres` no healthy | Puerto ocupado o volumen corrupto | `docker compose down -v && docker compose up -d` |
| `frontend` 404 en API | Nginx proxy mal configurado | Verificar `proxy_pass http://backend:4000` en nginx.conf |
| Frontend carga pero no datos | CORS | Verificar `FRONTEND_URL` en `.env` del backend |
| Puerto 5432 ocupado en host | Otro PostgreSQL local | Usar perfil dev (puerto 5433) o cambiar `DB_PORT` |
| Backend no responde | Error de Node | `docker compose restart backend` |
| Contenedores no arrancan | WSL integration off | Docker Desktop → Settings → Resources → WSL Integration |
| "no space left" en volumen | Logs o datos crecieron | `docker system prune -af` (limpiar) |
| Error de permisos al buildear | WSL filesystem vs NTFS | Asegurar que los proyectos están en NTFS, no dentro de WSL |
| `games_tracker_prod` no existe | Base no creada | `docker exec games_tracker_db psql -U postgres -c "CREATE DATABASE games_tracker_prod;"` |

---

## Arquitectura de Red y Puertos

### Redes Docker

| Perfil | Red | Contenedores |
|--------|-----|-------------|
| Dev | `games_dev_network` | `games_tracker_dev_db`, `games_tracker_dev_backend`, `games_tracker_dev_frontend` |
| Prod | `games_network` | `games_tracker_db`, `games_tracker_backend`, `games_tracker_frontend`, `games_tracker_backend_prod`, `games_tracker_frontend_prod` |

### Puertos expuestos al host

#### Dev (`docker-compose.dev.yml`)

| Servicio | Puerto Host | Puerto Contenedor | Container Name |
|----------|-------------|-------------------|----------------|
| postgres | 5433 | 5432 | `games_tracker_dev_db` |
| backend | 4001 | 4000 | `games_tracker_dev_backend` |
| frontend | 3001 | 80 | `games_tracker_dev_frontend` |

#### Prod (`docker-compose.yml` + `docker-compose.prod.yml`)

| Servicio | Puerto Host | Puerto Contenedor | Container Name |
|----------|-------------|-------------------|----------------|
| postgres | 5432 | 5432 | `games_tracker_db` |
| backend (base) | 4000 | 4000 | `games_tracker_backend` |
| frontend (base) | 3000 | 80 | `games_tracker_frontend` |
| backend-prod | 4001 | 4000 | `games_tracker_backend_prod` |
| frontend-prod | 9090 | 9090 | `games_tracker_frontend_prod` |

### Volúmenes persistentes

| Volumen | Perfil | Base de Datos | Propósito |
|---------|--------|---------------|-----------|
| `postgres_data` | Prod | `games_tracker` + `games_tracker_prod` | Datos de producción |
| `postgres_dev_data` | Dev | `games_tracker` | Datos de desarrollo |

> ⚠️ Ambos volúmenes sobreviven a `docker compose down`. Solo se eliminan con `docker compose down -v`.

### ⚠️ Error común: upstream "backend" no encontrado

Si el frontend-prod no arranca con `host not found in upstream "backend"`, es porque el `nginx.conf` dentro de la imagen apunta a `http://backend:4000` pero el servicio en prod se llama `backend-prod`.

**Solución:** Montar un `nginx.prod.conf` con el upstream correcto (ya configurado en `docker-compose.prod.yml` vía volumen):

```yaml
volumes:
  - ./nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
```

El archivo `nginx.prod.conf` escucha en puerto 9090 y apunta a `backend-prod:4000`.

### Comunicación interna

Los servicios se comunican por DNS interno (bridge):

```
Dev:  postgres:5432 → backend usa este host
Dev:  backend:4000  → frontend usa este host como proxy

Prod: postgres:5432 → backend y backend-prod usan este host
Prod: backend-prod:4000  → frontend-prod usa este host como proxy
```

---

## Extra: Desarrollo Sin Docker

```bash
# Solo backend con SQLite (recomendado para features)
npm run dev:sqlite

# Solo backend con PostgreSQL (necesita postgres corriendo local)
npm run dev:postgres

# Frontend standalone
cd ../games-tracker
npm run dev
```
