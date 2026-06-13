## 🐳 Docker - PostgreSQL (Cuando uses DB_TYPE=postgresql)

> ⚠️ En Windows el backend es **WSL 2**, no Hyper-V.  
> Asegurate que Docker Desktop tenga integración con WSL activada (Settings → Resources → WSL Integration → Ubuntu).

### Requisitos

```bash
# Verificar Docker
docker --version

# Verificar WSL
wsl -l -v

# Verificar que Ubuntu está running
wsl -l -v | findstr "Ubuntu"
```

### Versión de PostgreSQL

Imagen usada: **postgres:17-alpine** (latest stable).

```yaml
# en docker-compose.yml
image: postgres:17-alpine
```

### Levantar PostgreSQL manualmente (sin docker-compose)

```bash
# Crear red (solo primera vez)
docker network create games_network

# Correr contenedor PostgreSQL
docker run -d `
  --name games_tracker_db `
  --network games_network `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=games_tracker `
  -p 5432:5432 `
  -v postgres_data:/var/lib/postgresql/data `
  -v ${PWD}/init.sql:/docker-entrypoint-initdb.d/init.sql `
  postgres:17-alpine
```

### Usando docker-compose

```bash
# Crear y correr contenedores
docker-compose up -d

# Verificar servicios
docker-compose ps

# Ver logs
docker-compose logs -f postgres
docker-compose logs -f backend
```

### Detener

```bash
# Pausar (mantiene datos)
docker-compose stop

# Eliminar (borra todo)
docker-compose down

# Eliminar incluyendo volúmenes (BD limpia)
docker-compose down -v
```

### Conectarse a PostgreSQL desde terminal

```bash
# En WSL/Linux (container_name: games_tracker_db)
docker exec -it games_tracker_db psql -U postgres -d games_tracker

# Dentro de psql
\dt                            # Listar tablas
SELECT * FROM consoles;        # Ver consolas
SELECT * FROM games;           # Ver juegos
\d+ games_view                 # Ver definición de vista
\q                             # Salir
```

### Migrar de versión de PostgreSQL

```bash
# 1. Bajar y eliminar volúmenes
docker-compose down -v

# 2. Actualizar imagen en docker-compose.yml
#    image: postgres:17-alpine

# 3. Volver a levantar
docker-compose up -d
```

### Mantenimiento

Ver el manual completo en [🐳 DOCKER.md](../../docs/DOCKER.md) que cubre:

- Ciclo de vida de servicios (up/down/restart)
- Rebuild después de cambios
- Logs y monitoreo
- Backup y restore de la BD
- Actualización de imágenes (PostgreSQL, Node, Nginx)
- Escenarios de recuperación
- Arquitectura de red y puertos

### Troubleshooting

| Problema | Solución |
|----------|----------|
| Puerto 5432 ocupado | Cambiar `DB_PORT` en `.env` (ej: 5433) |
| Container no arranca | `docker compose logs postgres` |
| WSL no integrado | Docker Desktop → Settings → Resources → WSL Integration → habilitar Ubuntu |
| Datos corruptos | `docker compose down -v && docker compose up -d` |
| Error al buildear frontend | Revisar `context: ../games-tracker` en docker-compose.yml |
