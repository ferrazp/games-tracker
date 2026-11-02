# Backup de la base de datos

Desde v1.5.0 los backups, restauraciones y rollbacks de producción se hacen con los scripts del monorepo:

```bash
npm run prod:backup
npm run prod:restore -- <archivo.sql.gz>
npm run prod:rollback
```

Ver [`docs/OPERACION.md`](../../../docs/OPERACION.md) en la raíz del repo. Los `docker-compose*.yml` y contenedores `games_tracker_*` que describía la versión anterior de este documento ya no existen.
