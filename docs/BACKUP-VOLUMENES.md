# Estrategia de Backup para Volúmenes Persistentes PostgreSQL

> ⚠️ **Riesgo**: Los volúmenes Docker (`postgres_data`, `postgres_dev_data`) viven en el disco local del host. Un formateo, reinstalación de Windows, o `docker compose down -v` los destruye permanentemente.

## Recomendación: Backup Periódico vía `pg_dump`

La forma más segura y portable de respaldar la base de datos es exportar un archivo SQL con `pg_dump`. Este archivo vive fuera de Docker y se puede restaurar en cualquier PostgreSQL, incluso sin Docker.

### Backup Manual

```powershell
# Crear carpeta de respaldos
New-Item -ItemType Directory -Force -Path backups

# Respaldo producción (main, base games_tracker_prod)
docker exec games_tracker_db pg_dump -U postgres games_tracker_prod > backups/prod_$(Get-Date -Format yyyyMMdd).sql

# Respaldo desarrollo (develop)
docker exec games_tracker_dev_db pg_dump -U postgres games_tracker > backups/dev_$(Get-Date -Format yyyyMMdd).sql
```

### Backup Automático (Script PowerShell)

**`scripts/backup-db.ps1`** (ya documentado en DOCKER.md):

```powershell
$date = Get-Date -Format yyyyMMdd-HHmmss
$file = "backups/backup-$date.sql"
New-Item -ItemType Directory -Force -Path backups | Out-Null
# Backup de producción (ajustar container y DB name según perfil)
docker exec games_tracker_db pg_dump -U postgres games_tracker_prod > backups/prod_$(Get-Date -Format yyyyMMdd-HHmmss).sql
# Backup de desarrollo
docker exec games_tracker_dev_db pg_dump -U postgres games_tracker > backups/dev_$(Get-Date -Format yyyyMMdd-HHmmss).sql
Write-Host "Backup saved: $file"
```

### Programar Backup Automático (Windows Task Scheduler)

1. Abrir **Task Scheduler**
2. Crear tarea básica:
   - **Disparador**: Diario a las 03:00 AM
   - **Acción**: `powershell.exe`
   - **Argumentos**: `-File "F:\projects\developments\games-tracker-backend\scripts\backup-db.ps1"`
   - **Ejecutar como**: Usuario actual
3. Asegurar que la carpeta `backups/` existe y está accesible

### Programar Backup Automático (WSL / Linux cron)

```bash
# Editar crontab
crontab -e

# Añadir línea para backup diario a las 3 AM
0 3 * * * cd /path/to/project && docker exec games_tracker_db pg_dump -U postgres games_tracker_prod > backups/$(date +\%Y\%m\%d).sql
```

## Store Backup Fuera del Host

Para protección contra formateo:

| Destino | Método |
|---------|--------|
| Google Drive / OneDrive / Dropbox | Sincronizar la carpeta `backups/` con el cliente de escritorio |
| NAS local | Script de copia a una unidad de red (`\\nas\backups\`) |
| GitHub (privado) | Subir backups a un repo privado (¡no incluir secretos!) |
| USB externo | Script que monta la unidad USB y copia los `.sql` |

## Restore

```powershell
# Si el volumen se perdió completamente:
docker compose down -v
docker compose up -d
# Esperar a que postgres esté healthy
# Si el backup es de games_tracker_prod
Get-Content backups/prod_20260612.sql | docker exec -i games_tracker_db psql -U postgres games_tracker_prod

# Si es restore desde init.sql (schema + consolas)
Get-Content init.sql | docker exec -i games_tracker_db psql -U postgres games_tracker_prod
Get-Content backups/prod_20260612.sql | docker exec -i games_tracker_db psql -U postgres games_tracker_prod
```

## Verificar Integridad

```powershell
# Listar tablas y conteos (desarrollo)
docker exec games_tracker_dev_db psql -U postgres games_tracker -c "\dt+"
docker exec games_tracker_dev_db psql -U postgres games_tracker -c "SELECT COUNT(*) FROM consoles; SELECT COUNT(*) FROM games; SELECT COUNT(*) FROM game_catalog;"

# Listar tablas y conteos (producción)
docker exec games_tracker_db psql -U postgres games_tracker_prod -c "\dt+"
docker exec games_tracker_db psql -U postgres games_tracker_prod -c "SELECT COUNT(*) FROM consoles; SELECT COUNT(*) FROM games; SELECT COUNT(*) FROM game_catalog;"
```

## Resumen: Qué NO Hacer

| Acción | Consecuencia |
|--------|-------------|
| `docker compose down -v` | Destruye TODOS los datos del volumen |
| `docker system prune -a --volumes` | Destruye TODOS los volúmenes huérfanos |
| Formatear disco C: | Destruye `C:\ProgramData\Docker\volumes\` |
| Desinstalar Docker Desktop | Destruye volúmenes (a menos que se migren antes) |

Para proteger contra cualquiera de estos escenarios: **mantener backups SQL fuera del host**.
