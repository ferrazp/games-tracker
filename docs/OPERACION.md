# Operación: QA y Producción

Los dos ambientes corren en Docker en esta PC, aislados por nombre de proyecto compose. Todo se maneja con npm scripts desde la raíz del repo.

## Uso diario: el acceso directo

El acceso directo **Games Tracker** del escritorio abre `games-tracker.cmd` (raíz del repo), un menú para levantar y bajar Prod, QA y Dev, abrir la web, ver el estado y hacer backups. Si Docker Desktop está cerrado, lo inicia. Para recrear el acceso directo: `npm run shortcut`.

> El puerto de prod es **8090** porque el 8080 de esta PC lo usa otro servicio (`MTAgentService`).

| | QA | Prod |
|---|---|---|
| URL | http://localhost:8081 | http://localhost:8090 |
| Proyecto compose | `gt-qa` | `gt-prod` |
| Configuración | `deploy/qa.env` | `deploy/prod.env` |
| Volumen | `gt-qa_db_data` (se borra con `qa:reset`) | `gt-prod_db_data` (**external**: ningún comando lo borra) |
| Postgres | `127.0.0.1:5434` (para inspeccionar) | no publicado |
| API | solo `/api` a través del front | solo `/api` a través del front |

Archivos: `deploy/compose.yaml` (base) + `deploy/compose.qa.yaml` / `deploy/compose.prod.yaml` (diferencias). Scripts: `deploy/scripts/qa.mjs` y `prod.mjs`; la lógica pura está en `lib.mjs`, con tests.

## Primera vez

1. Copiar `deploy/qa.env.example` → `deploy/qa.env` y `deploy/prod.env.example` → `deploy/prod.env`, y completar los secretos. Ninguno se commitea.
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
   `JWT_SECRET` (≥ 32 caracteres), `ADMIN_PASS` y `DB_PASSWORD` tienen que ser distintos en cada ambiente.
2. Si los paquetes de GHCR son privados: `gh auth token | docker login ghcr.io -u ferrazp --password-stdin` (el token de `gh` necesita el scope `read:packages`: `gh auth refresh -s read:packages`).

## Ciclo de un release

1. Se une el PR `chore(main): release X.Y.Z` → GitHub publica el tag `vX.Y.Z` y las imágenes `:X.Y.Z`.
2. Probar en QA esa misma imagen:
   ```bash
   npm run qa:up -- --tag X.Y.Z
   ```
3. Promover a prod (sin recompilar):
   ```bash
   npm run prod:deploy -- X.Y.Z
   ```
   `prod:deploy` aborta antes de tocar nada si el release o las imágenes no existen, y pide escribir `prod` si esa versión no es la que está probada en QA (`deploy/.qa-version`). Después: crea el volumen si falta, hace un backup si hay datos, baja las imágenes, levanta y espera el healthcheck (90 s), y registra la versión en `deploy/.prod-version`.

## QA

| Comando | Qué hace |
|---|---|
| `npm run qa:up` | Levanta QA con `IMAGE_TAG` de `deploy/qa.env` (por defecto `main`) |
| `npm run qa:up -- --tag sha-abc1234` | Una imagen concreta: `main`, `sha-<7>` o `X.Y.Z` |
| `npm run qa:up -- --tag local --no-pull` | Imágenes construidas localmente (ver abajo) |
| `npm run qa:up -- --restore <dump.sql.gz>` | Levanta y carga un dump (por ejemplo, un backup de prod) |
| `npm run qa:down` | Para QA; los datos quedan |
| `npm run qa:reset` | Borra contenedores **y datos** de QA; pide escribir `qa` |

Construir imágenes locales (desde la raíz):

```bash
docker build -f apps/backend/Dockerfile  -t ghcr.io/ferrazp/games-tracker-backend:local .
docker build -f apps/frontend/Dockerfile -t ghcr.io/ferrazp/games-tracker-frontend:local .
```

## Prod

| Comando | Qué hace |
|---|---|
| `npm run prod:deploy -- X.Y.Z` | Despliega un release (ver arriba) |
| `npm run prod:start` | Levanta la versión ya desplegada (sin bajar imágenes ni tocar datos) |
| `npm run prod:stop` | Baja los contenedores; los datos quedan en el volumen |
| `npm run prod:status` | Versión desplegada, contenedores, `/api/version`, conteos y último backup |
| `npm run prod:backup` | Backup ahora |
| `npm run prod:restore -- <archivo.sql.gz>` | Reemplaza los datos de prod; antes hace un backup de seguridad; pide escribir `prod` |
| `npm run prod:rollback` | Vuelve a la versión anterior y restaura los datos de antes del último deploy; antes hace un backup de seguridad; pide escribir `prod` |

### Backups

- Carpeta: `BACKUP_DIR` en `deploy/prod.env` (por defecto `%USERPROFILE%\games-tracker-backups`).
- Nombre: `gt-prod-YYYYMMDD-HHmmss-vX.Y.Z.sql.gz` (la versión es la que estaba corriendo).
- Se conservan los **últimos 30**; los más viejos se borran solos al hacer un backup nuevo.
- Son `pg_dump` en texto plano comprimido: se pueden abrir con cualquier Postgres, sin Docker.
- Recomendado: copiar esa carpeta a la nube o a otro disco de vez en cuando (un formateo de la PC borra los volúmenes de Docker).

### Rollback, paso a paso

`deploy/.prod-version` guarda una línea por evento (separada por tabs): `<versión> <ok|failed|rollback> <backup tomado antes> <nota>`. Un deploy que no queda healthy se registra como `failed`. `prod:rollback`:
1. calcula el destino: si el último deploy falló, la última versión `ok`; si no, la `ok` anterior (un segundo rollback sigue hacia atrás),
2. verifica que el backup a restaurar exista y no esté dañado, y baja las imágenes,
3. hace un backup de seguridad de la versión actual,
4. restaura, en una sola transacción, el backup tomado antes de ese deploy (por si la versión nueva migró datos),
5. levanta las imágenes de la versión destino.

Si solo hay que volver a una versión puntual sin tocar datos: `npm run prod:deploy -- X.Y.Z`.

## Sagas

- El backend corre los jobs de sagas (completar IDs de IGDB, resolver cada juego a su juego canónico y su saga, refrescar las sagas de más de 7 días) **10 s después de arrancar y luego cada 24 h**, solo si hay credenciales de IGDB (`TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`). Sin credenciales la pestaña Sagas muestra que falta configurarlas.
- También corren en segundo plano al crear o editar un juego y al elegir su juego de IGDB, así no hay que esperar al job diario. Nunca corren dos a la vez: si llega un pedido mientras corren, se hace una corrida más al terminar.
- Un error de IGDB en un juego o una saga se loguea y el resto sigue; lo que falló se reintenta en la próxima corrida.
- Los juegos que se archivan desde el menú ⋯ de una saga quedan en la tabla `saga_archived`, aparte del caché de IGDB: los refrescos no los deshacen y se recuperan con **Restaurar** en *Archivados* del mismo menú.
- Las versiones que el usuario une (tocar un juego → *Unir con otras versiones*, o *Ya lo jugué en otra versión* en Sugerir) quedan en `saga_links`, también aparte del caché de IGDB. Todas toman el estado de lo registrado del grupo y se separan desde el mismo panel.
- Para ensayar con datos reales, levantar QA con un backup de prod (no toca prod):
  ```bash
  npm run qa:up -- --tag <tag> --restore <backup>
  ```
  con `<backup>` un `gt-prod-….sql.gz` de `BACKUP_DIR`. QA necesita sus propias credenciales de IGDB en `deploy/qa.env`.

## Problemas comunes

| Síntoma | Causa probable |
|---|---|
| `Falta deploy/<amb>.env` | Copiar el `.example` y completarlo |
| `prod:deploy` falló el healthcheck | Mirar los logs con el comando que imprime y volver con `npm run prod:rollback` (restaura el backup tomado antes de ese deploy) |
| `No existen las imágenes :X.Y.Z en GHCR` | El workflow *Release* todavía no terminó, o falta `docker login ghcr.io` |
| El backend se reinicia en loop | `JWT_SECRET` corto o `ADMIN_PASS` débil (en producción se rechazan): `docker compose -p gt-prod --env-file deploy/prod.env -f deploy/compose.yaml -f deploy/compose.prod.yaml logs backend` |
| `/api/...` devuelve 502 | El backend todavía no está healthy |
| Ver los datos de QA | Cualquier cliente Postgres en `127.0.0.1:5434`, usuario y clave de `deploy/qa.env` |
