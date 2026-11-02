## 🐳 Docker - PostgreSQL

> ⚠️ En Windows el backend es **WSL 2**, no Hyper-V.
> Asegurate que Docker Desktop tenga integración con WSL activada (Settings → Resources → WSL Integration → Ubuntu).

### Perfiles Docker

| Perfil | Comando | DB Name | Puerto DB Host | Volumen |
|--------|---------|---------|----------------|---------|
| Dev | `docker compose -f docker-compose.dev.yml up -d` | `games_tracker` | 5433 | `postgres_dev_data` |
| Prod | `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` | `games_tracker_prod` | 5432 | `postgres_data` |

### Versión de PostgreSQL

Imagen usada: **postgres:17-alpine** en ambos perfiles.

### Conectarse a PostgreSQL desde terminal

```bash
# Desarrollo
docker exec -it games_tracker_dev_db psql -U postgres -d games_tracker

# Producción
docker exec -it games_tracker_db psql -U postgres -d games_tracker_prod

# Dentro de psql
\dt                            # Listar tablas
SELECT * FROM consoles;        # Ver consolas
SELECT * FROM games;           # Ver juegos
\d+ games_view                 # Ver definición de vista
\q                             # Salir
```

### Mantenimiento

See [🐳 DOCKER.md](../DOCKER.md) para:

- Ciclo de vida de servicios (up/down/restart)
- Rebuild después de cambios
- Logs y monitoreo
- Backup y restore de la BD
- Escenarios de recuperación
- Arquitectura de red y puertos

### Troubleshooting

| Problema | Solución |
|----------|----------|
| Puerto 5432 ocupado | Usar perfil dev (puerto 5433) o cambiar `DB_PORT` en `.env` |
| Container no arranca | `docker compose logs postgres` |
| WSL no integrado | Docker Desktop → Settings → Resources → WSL Integration → habilitar Ubuntu |
| Datos corruptos | `docker compose down -v && docker compose up -d` (⚠️ borra datos) |
| Error `host not found in upstream "backend"` | Montar `nginx.prod.conf` con `proxy_pass http://backend-prod:4000` (ya configurado en prod) |
