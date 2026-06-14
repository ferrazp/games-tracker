## 🚀 Despliegue con Docker

> Ver también: [🌍 Perfiles de Ambiente](../perfiles-ambiente/AGENTS.md) y [🐳 DOCKER.md](../DOCKER.md)

### Perfiles de Despliegue

| Perfil | Comando | Frontend | API | DB Host |
|--------|---------|----------|-----|---------|
| **Dev** | `docker compose -f docker-compose.dev.yml up -d` | `:3001` | `:4001` | `:5433` |
| **Prod** | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` | `:9090` | `:4001` | `:5432` |

---

### 📋 Checklist: Despliegue a Producción

Cuando decidas "pasemos a prod", seguir estos pasos en orden:

#### 1. Preparación

```powershell
# Verificar que estás en main
git checkout main && git pull

# Verificar que develop tiene los cambios que querés
git log develop..main --oneline
```

#### 2. Build y Deploy

```powershell
cd F:\projects\developments\games-tracker-backend

# Levantar servicios base + prod
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Esperar a que todo esté healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

#### 3. Verificar

```powershell
# Health check backend
curl http://localhost:4001/health

# Consolas precargadas (deberían ser 17)
curl http://localhost:4001/consoles

# Frontend (puerto 9090)
curl http://localhost:9090

# Verificar que la DB correcta está en uso:
# Debería mostrar "games_tracker_prod"
curl http://localhost:4001/health | ConvertFrom-Json | Select -ExpandProperty database
```

#### 4. Si es primera vez — Seed de datos

```powershell
# Seed imágenes de consolas
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend-prod node scripts/seed-console-images.js

# Migrar game_catalog desde dev (si existe)
# See DOCKER.md → Migrar catálogo de dev a prod
```

---

### ⚠️ Reglas para Merge develop → main

Para no pisar la configuración de producción al mergear:

| Archivo | develop | main | ¿Conflicto? |
|---------|---------|------|-------------|
| `docker-compose.yml` | Base (postgres + backend + frontend) | Idéntico | ✅ Sin conflicto esperado |
| `docker-compose.dev.yml` | Solo existe en develop | No existe en main | ✅ Se mergea |
| `docker-compose.prod.yml` | Override de producción | Idéntico | ✅ Sin conflicto esperado |
| `init.sql` | Schema + seed consolas | Idéntico | ✅ |
| `.env.example` | Template de variables | Idéntico | ✅ |
| `docs/` | Documentación actualizada | Puede diferir | ⚠️ Resolver aceptando develop |
| `server-unified.js` | Código del servidor | Idéntico | ✅ |
| `db/database.js` | Driver BD | Idéntico | ✅ |

**Regla:** Los archivos de configuración de entorno (`docker-compose.dev.yml`, `.env`) y documentación (`docs/`) pueden diferir entre ramas. El código fuente (`server-unified.js`, `db/`, `init.sql`) debe ser idéntico.

---

### Arquitectura de Servicios (Prod)

```
5 contenedores en red `games_network`:

┌─────────────────────────────────────────────────────┐
│ games_tracker_db (postgres:17)                      │
│   - Puertos: 5432:5432                              │
│   - Bases: games_tracker (base) +                    │
│            games_tracker_prod (producción)            │
│   - Volumen: postgres_data                          │
└────────────┬────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌─────────────┐ ┌──────────────────┐
│ backend     │ │ backend-prod     │
│ (:4000)     │ │ (:4001)          │
│ DB: tracker │ │ DB: tracker_prod │
└──────┬──────┘ └────────┬─────────┘
       │                 │
       ▼                 ▼
┌─────────────┐ ┌──────────────────┐
│ frontend    │ │ frontend-prod    │
│ (:3000)     │ │ (:9090)          │
└─────────────┘ └──────────────────┘
```

### Troubleshooting de Despliegue

| Problema | Causa | Solución |
|----------|-------|----------|
| `games_tracker_prod` DB no existe | Base no creada | `docker exec games_tracker_db psql -U postgres -c "CREATE DATABASE games_tracker_prod;"` |
| Error 502 en frontend | Backend no responde | `docker compose logs backend-prod` para debug |
| Puerto 9090 ocupado | Otro servicio en el puerto | Verificar con `Get-NetTCPConnection -LocalPort 9090` y detener el proceso |
| CORS bloquea requests | FRONTEND_URL incorrecto | En prod debe ser `http://localhost:9090` |
| Seed de imágenes no funciona | Consolas ya tienen imágenes | Es idempotente, se puede ejecutar varias veces |
