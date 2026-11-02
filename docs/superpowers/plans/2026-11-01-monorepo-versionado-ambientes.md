# Monorepo, versionado y ambientes QA/Prod — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** unir front y back en el monorepo `ferrazp/games-tracker` con historial completo, GitHub Flow + release-please + CI, e imágenes versionadas en GHCR desplegadas en dos ambientes Docker aislados (QA y Prod) en la PC del usuario.

**Architecture:** npm workspaces (`apps/backend`, `apps/frontend`). Un solo `deploy/compose.yaml` parametrizado por nombre de proyecto (`gt-qa` / `gt-prod`) y archivo de entorno. El front se compila con `VITE_API_URL=/api` y su nginx hace proxy a `backend`, así la misma imagen sirve para los dos ambientes. Los scripts operativos son Node `.mjs`, con la lógica pura en `deploy/scripts/lib.mjs` y testeada con `node --test`.

**Tech Stack:** Node 24, npm 11 workspaces, Express 5, React 19 + Vite 7, Postgres 17, Docker Compose v5, GitHub Actions, release-please, commitlint + husky, GHCR.

**Spec:** `docs/superpowers/specs/2026-11-01-monorepo-versionado-ambientes-design.md` (en el monorepo: `docs/superpowers/specs/...`).

## Global Constraints

- Una sola versión SemVer para la app: `package.json` raíz + `apps/backend/package.json` + `apps/frontend/package.json` siempre iguales.
- Primera versión del monorepo: `v1.5.0`. El manifest de release-please arranca en `1.4.1`.
- Conventional Commits; títulos de PR validados en CI; squash merge como único método **después** de la Tarea 3.
- Imágenes: `ghcr.io/ferrazp/games-tracker-backend` y `ghcr.io/ferrazp/games-tracker-frontend`. Tags: push a `main` → `main` y `sha-<7>`; release → `X.Y.Z`, `X.Y` y `latest`.
- Proyectos compose: `gt-qa` (front `8081`, Postgres `127.0.0.1:5434`) y `gt-prod` (front `8080`, Postgres no publicado). La API nunca se publica: solo `/api` a través del front.
- Volumen de prod `gt-prod_db_data` con `external: true`. Volumen de QA `gt-qa_db_data` normal.
- Backups en `BACKUP_DIR` (default `%USERPROFILE%\games-tracker-backups`), nombre `gt-prod-<YYYYMMDD-HHmmss>-v<versión>.sql.gz`; se retienen los últimos 30.
- Confirmaciones destructivas: `qa:reset` pide escribir `qa`; `prod:restore` y `prod:rollback` piden escribir `prod`.
- Secreto de release-please: `RELEASE_PLEASE_TOKEN` (fine-grained PAT, Contents RW + Pull requests RW, solo `ferrazp/games-tracker`).
- Nunca commitear `.env`, `deploy/*.env`, `deploy/.prod-version`, `deploy/.qa-version`, `*.db`.
- **[Decisión del plan]** Runtime Node 24 (Node 20 está fuera de soporte desde abril de 2026): Dockerfiles `node:24-slim`, CI con Node 24, `engines.node: ">=22"`.
- **[Decisión del plan]** El monorepo se trabaja en una carpeta nueva, `F:\projects\developments\games-tracker-monorepo`. Las carpetas viejas no se tocan ni se borran.
- Cualquier acción que publique o modifique cosas en GitHub, o que borre datos, se confirma con el usuario justo antes de ejecutarla (marcadas con 🔒).

## Review Focus

1. **Squash merge del PR del monorepo destruye el historial del front.** Un squash aplana el merge de historias no relacionadas. El PR #1 (Tarea 2) se une con *merge commit*, y solo después se configura el modo solo-squash (Tarea 3, paso final). Verificación: `git log --oneline -- apps/frontend | wc -l` en `main` ≥ 50 después del merge.
2. **`down -v` sobre prod.** Un `docker compose -p gt-prod down -v` no debe borrar `gt-prod_db_data`. Se prueba en la Tarea 5 con un volumen de prueba external.
3. **Front llamando a `localhost:4000` en Docker.** Si el build no recibe `VITE_API_URL=/api`, la imagen apunta a localhost. Test en la Tarea 4 sobre el bundle (`grep -L localhost:4000 dist/assets/*.js`).
4. **Body grandes (imágenes Base64) a través del proxy.** nginx rechaza con 413 cuerpos de más de 1 MB por defecto; Express acepta 5 MB. `client_max_body_size 10m` en `/api/`; smoke de un `POST /api/games` con una imagen de 2 MB en la Tarea 5.
5. **`prod:deploy` con una versión inexistente o sin probar en QA.** Debe abortar antes del backup y del pull si el release o la imagen no existen, y pedir confirmación si `deploy/.qa-version` no coincide. Tests de `lib.mjs` en la Tarea 5.

---

### Task 0: Cerrar v1.4.1 en los dos repos 🔒

**Files:** ninguno nuevo (ramas `hotfix/v1.4.1` ya commiteadas en `F:\projects\developments\games-tracker-backend` y `F:\projects\developments\games-tracker`).

- [ ] **Step 1:** en cada repo, `npm test`. Esperado: back 164 pass, front 46 pass.
- [ ] **Step 2:** en cada repo, `git flow hotfix finish -m "v1.4.1" v1.4.1`. Esperado: `main` y `develop` contienen el hotfix; tag `v1.4.1` creado.
- [ ] **Step 3 🔒:** confirmar con el usuario y hacer `git push origin main develop --tags` en cada repo. Verificar con `gh api repos/ferrazp/<repo>/git/refs/tags/v1.4.1`.

### Task 1: Respaldo e inventario de todos los volúmenes Postgres existentes

**Files:**
- Create (temporal, fuera del repo): `<scratchpad>/inspect-volumes.mjs`

**Interfaces:**
- Produces: `BACKUP_DIR/pre-migracion/<volumen>/<bd>.sql.gz` y la tabla de conteos que la Tarea 7 usa para que el usuario elija la fuente de prod.

- [ ] **Step 1:** escribir `inspect-volumes.mjs`. Para cada volumen de `docker volume ls --format "{{.Name}}"` que contenga `postgres`:
  1. `docker run -d --rm --name gt-inspect-<n> -v <vol>:/var/lib/postgresql/data postgres:17-alpine` y esperar `pg_isready`.
  2. Listar BDs: `psql -U postgres -Atc "select datname from pg_database where not datistemplate"`.
  3. Para cada BD: `pg_dump -U postgres <bd> | gzip` y escribir el archivo en `BACKUP_DIR/pre-migracion/<vol>/<bd>.sql.gz`.
  4. Contar `games`, `consoles`, `game_catalog` y `game_wishlist` (0 si la tabla no existe).
  5. `docker stop`.

  Si el usuario de la BD no es `postgres`, leer `DB_USER` de `games-tracker-backend/.env`.
- [ ] **Step 2:** asegurarse de que los contenedores viejos estén detenidos (`games_tracker_db`, `games_tracker_backend_prod`, `games_tracker_frontend_prod`; hoy ya figuran como `Exited`) y ejecutar el script. Esperado: un `.sql.gz` no vacío por cada BD, y una tabla impresa `volumen | bd | games | consoles | catalog | wishlist`.
- [ ] **Step 3:** mostrarle la tabla al usuario y guardar su respuesta (qué BD es la fuente de prod y cuál, si alguna, la de QA) en `BACKUP_DIR/pre-migracion/ELECCION.txt`.

### Task 2: Monorepo con historial completo (PR #1, merge commit)

**Files:**
- Create: `games-tracker-monorepo/` (clon de `ferrazp/games-tracker`), `package.json` raíz, `package-lock.json` raíz, `.gitignore` raíz, `.nvmrc` (`24`).
- Move: todo el backend → `apps/backend/`; todo el front → `apps/frontend/`; `apps/*/docs/superpowers/**` → `docs/superpowers/**`; `apps/*/CHANGELOG.md` → `apps/*/CHANGELOG.legacy.md`.
- Delete: `apps/*/package-lock.json`.

**Interfaces:**
- Produces: scripts raíz que usan las Tareas 3 a 5: `npm test` (todos los workspaces más `deploy/scripts`), `npm run build` (front), `npm run dev`. Workspaces con nombre `games-backend` y `games-tracker` (los nombres actuales de los package.json).

- [ ] **Step 1:** `pip install git-filter-repo`; `git filter-repo --version` imprime una versión.
- [ ] **Step 2:** clonar `ferrazp/games-tracker` en `games-tracker-monorepo` y `ferrazp/games-tracker-front` en `<scratchpad>/front-rewrite`.
- [ ] **Step 3:** en `front-rewrite`: `git tag -l "*-dev*" | xargs git tag -d`, luego `git filter-repo --to-subdirectory-filter apps/frontend --tag-rename v:frontend/v`. Esperado: `git tag` muestra solo `frontend/v*`.
- [ ] **Step 4:** en `games-tracker-monorepo`, rama `chore/monorepo` desde `main`: borrar los tags `-dev` locales, `git filter-repo --to-subdirectory-filter apps/backend --force`, y agregar de nuevo el `origin` (filter-repo lo quita).
- [ ] **Step 5:** `git remote add front <scratchpad>/front-rewrite && git fetch front --tags && git merge --allow-unrelated-histories front/main -m "chore: import frontend history into apps/frontend"`.
- [ ] **Step 6:** crear el `package.json` raíz: `"private": true`, `"name": "games-tracker"`, `"version": "1.4.1"`, `"workspaces": ["apps/*"]`, `"engines": {"node": ">=22"}`. Scripts:
  - `"test": "npm test --workspaces && node --test deploy/scripts/test/"`
  - `"build": "npm run build -w games-tracker"`
  - `"dev"`: `concurrently` (devDependency) corriendo `npm run dev -w games-backend` y `npm start -w games-tracker`.

  Unificar los `.gitignore` (agregar `deploy/*.env`, `deploy/.prod-version`, `deploy/.qa-version`). Borrar los locks de cada app y correr `npm install` en la raíz. Poner `"version": "1.4.1"` en los dos package.json de las apps (`npm pkg set`). Mover los docs y los changelogs según **Files**.
- [ ] **Step 7:** reemplazar los scripts `set DB_TYPE=... &&` de `apps/backend/package.json` por `node --env-file-if-exists=.env` más variables vía `cross-env` (devDependency), para que funcionen en PowerShell, cmd y Linux.
- [ ] **Step 8:** copiar a mano los archivos no versionados `games-tracker-backend/.env` → `apps/backend/.env` y `games-tracker-backend/games.db` → `apps/backend/games.db`.
- [ ] **Step 9:** `npm test` en la raíz. Esperado: back 164 pass y front 46 pass. (`deploy/scripts/test/` todavía no existe: crear la carpeta con un `.gitkeep` y un test trivial `smoke.test.mjs` que verifica `1 + 1 === 2`, para que el script no falle; lo reemplaza la Tarea 5.) `npm run build` termina en `✓ built`.
- [ ] **Step 10:** verificar el historial: `git log --oneline -- apps/frontend | wc -l` ≥ 50 y `git log --oneline -- apps/backend | wc -l` ≥ 50; `git tag` contiene `v1.4.1` y `frontend/v1.4.1`.
- [ ] **Step 11:** commit `chore: set up npm workspaces monorepo`.
- [ ] **Step 12 🔒:** confirmar con el usuario, y luego: `git push -u origin chore/monorepo`, `git push origin --tags` y `gh pr create --title "chore: merge frontend and backend into a monorepo" --base main`. Unir con `gh pr merge --merge` (**merge commit, no squash**). Verificar el Review Focus 1 sobre `origin/main`.

### Task 3: Flujo git: commitlint, husky, CI, release-please, Dependabot y configuración del repo (PR #2)

**Files:**
- Create: `commitlint.config.js` (`extends: ['@commitlint/config-conventional']`), `.husky/commit-msg` (`npx --no -- commitlint --edit "$1"`), `.github/workflows/ci.yml`, `.github/workflows/pr-title.yml`, `.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json` (`{".": "1.4.1"}`), `.github/dependabot.yml`, `.github/pull_request_template.md`, `CONTRIBUTING.md`.
- Modify: `package.json` raíz (devDependencies `@commitlint/cli`, `@commitlint/config-conventional`, `husky`; script `"prepare": "husky"`).

**Interfaces:**
- Produces: un job de CI llamado **`ci`** (nombre exacto, es el check obligatorio del ruleset) y un workflow de release que la Tarea 4 extiende con la publicación de imágenes.

- [ ] **Step 1:** rama `feat/ci-release-deploy` desde `main` actualizado.
- [ ] **Step 2:** commitlint + husky. Verificar: `git commit --allow-empty -m "cambio sin formato"` es rechazado y `git commit --allow-empty -m "chore: test hook"` es aceptado (después `git reset HEAD~1`).
- [ ] **Step 3:** `ci.yml`, en `pull_request` y `push` a `main`. Job `ci`: `actions/checkout`, `actions/setup-node` (`node-version-file: .nvmrc`, cache npm), `npm ci`, `npm test`, `npm run build`. Las imágenes se agregan en la Tarea 4.
- [ ] **Step 4:** `pr-title.yml` con `amannn/action-semantic-pull-request` en `pull_request_target` (`opened`, `edited`, `synchronize`).
- [ ] **Step 5:** `release-please-config.json`:
  - `"release-type": "node"`, paquete `"."`.
  - `"last-release-sha"`: el SHA del merge commit del PR #1. Se usa en lugar de `bootstrap-sha` porque el tag `v1.4.1` ya existe, y release-please podría tomarlo como último release y arrastrar todo el historial del front al changelog. Se quita este campo después de publicar v1.5.0.
  - `"extra-files"`: los dos package.json de las apps, en `jsonpath: $.version`.
  - `"changelog-sections"` con `feat`, `fix`, `perf`, `revert` visibles y `docs`, `chore`, `refactor`, `test`, `ci` ocultos.

  `release-please.yml`, en `push` a `main`: `googleapis/release-please-action` con `token: ${{ secrets.RELEASE_PLEASE_TOKEN }}`, exponiendo como outputs `release_created` y `version`.
- [ ] **Step 6:** `dependabot.yml`, semanal, para los ecosistemas `npm` (directorio `/`), `github-actions` (`/`) y `docker` (`/apps/backend` y `/apps/frontend`), con un grupo por ecosistema para minor y patch.
- [ ] **Step 7:** validar los workflows: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`. Esperado: sin errores.
- [ ] **Step 8:** `CONTRIBUTING.md`: flujo de ramas `<tipo>/<desc>`, ejemplos de commits, PR con título convencional, cómo se crea un release, cómo crear y renovar `RELEASE_PLEASE_TOKEN`, y la tabla de ambientes del spec (4.6). Plantilla de PR: *Qué cambia / Cómo se probó / Checklist (tests, docs, título convencional)*.
- [ ] **Step 9:** commit `ci: add CI, PR title check, release-please and dependabot`.
  La Tarea 3 no abre el PR: el PR #2 incluye también las Tareas 4 y 5 y se abre en la Tarea 6.

### Task 4: Imágenes versionadas y front con API relativa

**Files:**
- Modify: `apps/frontend/nginx.conf` (agregar `location /api/`), `apps/frontend/Dockerfile` (`ARG VITE_API_URL=/api`, `node:24-slim`), `apps/backend/Dockerfile` (`node:24-slim`), `apps/frontend/src/config.js` (sin cambios de lógica: el default `http://localhost:4000` se mantiene para dev).
- Modify: `.github/workflows/ci.yml` (job `ci` construye las dos imágenes sin push con `docker/build-push-action`, `push: false`).
- Create: `.github/workflows/images.yml`.
- Test: `apps/frontend/src/config.test.js`.

**Interfaces:**
- Produces: imágenes `ghcr.io/ferrazp/games-tracker-{backend,frontend}:<tag>` con label `org.opencontainers.image.version`, que consume `deploy/compose.yaml` mediante `${IMAGE_TAG}`.

- [ ] **Step 1: test que falla** en `config.test.js`, con `vi.stubEnv('VITE_API_URL', '/api')` + `vi.resetModules()` + import dinámico:
  ```js
  it('usa VITE_API_URL relativa cuando está definida', async () => {
    vi.stubEnv('VITE_API_URL', '/api'); vi.resetModules();
    const { default: API_URL } = await import('./config.js');
    expect(API_URL).toBe('/api');
  });
  it('usa http://localhost:4000 en dev sin variable', async () => {
    vi.stubEnv('VITE_API_URL', ''); vi.resetModules();
    const { default: API_URL } = await import('./config.js');
    expect(API_URL).toBe('http://localhost:4000');
  });
  ```
  Correr `npm test -w games-tracker`. Si el primer test pasa sin cambios (el código ya lo soporta), queda como test de caracterización; el segundo debe fallar si `''` no cae al default (`||` ya lo cubre). Lo importante es que los dos queden.
- [ ] **Step 2:** nginx: `location /api/ { proxy_pass http://backend:4000/; proxy_http_version 1.1; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; client_max_body_size 10m; }`. El `/` final de `proxy_pass` quita el prefijo `/api`. Para que nginx no falle al arrancar si `backend` todavía no resuelve, usar `resolver 127.0.0.11 valid=10s;` con `set $backend http://backend:4000;` y `rewrite ^/api/(.*)$ /$1 break; proxy_pass $backend;`.
- [ ] **Step 3:** construir localmente: `docker build -t gt-frontend:local apps/frontend` y luego `docker run --rm gt-frontend:local sh -c "grep -l 'localhost:4000' /usr/share/nginx/html/assets/*.js || echo LIMPIO"`. Esperado: `LIMPIO` (Review Focus 3). `docker build -t gt-backend:local apps/backend` termina bien.
- [ ] **Step 4:** `images.yml`, con dos disparadores:
  - `push` a `main` → tags `main` y `sha-<7>`.
  - `workflow_call` / `workflow_run` desde release-please cuando `release_created == 'true'` → tags `X.Y.Z`, `X.Y` y `latest`.

  Implementarlo como un job en `release-please.yml` que depende de la salida `release_created` y hace checkout del tag `v${{ version }}`, y un workflow `images.yml` aparte solo para `main`. Usar `docker/metadata-action` + `docker/login-action` (GHCR, `GITHUB_TOKEN` con `packages: write`) + `docker/build-push-action`, en una matriz `[backend, frontend]`.
- [ ] **Step 5:** actionlint en verde. `npm test` en la raíz en verde.
- [ ] **Step 6:** commit `feat: versioned docker images with relative API for frontend`.

### Task 5: Ambientes aislados y scripts de operación

**Files:**
- Create: `deploy/compose.yaml`, `deploy/qa.env.example`, `deploy/prod.env.example`, `deploy/scripts/lib.mjs`, `deploy/scripts/qa.mjs`, `deploy/scripts/prod.mjs`, `deploy/scripts/test/lib.test.mjs`, `docs/OPERACION.md`.
- Modify: `package.json` raíz (scripts `qa:up`, `qa:down`, `qa:reset`, `prod:deploy`, `prod:backup`, `prod:restore`, `prod:rollback`, `prod:status`); `apps/backend/docs/BACKUP-VOLUMENES.md` (apunta a `docs/OPERACION.md`).
- Delete: `apps/backend/docker-compose.yml`, `apps/backend/docker-compose.dev.yml`, `apps/backend/docker-compose.prod.yml`, `apps/backend/nginx.prod.conf`, `deploy/scripts/test/smoke.test.mjs`.

**Interfaces (`deploy/scripts/lib.mjs`, todas puras):**
- `parseVersion(input: string): string`: acepta `1.5.0` o `v1.5.0` y devuelve `"1.5.0"`; lanza `Error` si no es SemVer.
- `backupFileName(version: string, date: Date): string` → `gt-prod-YYYYMMDD-HHmmss-v1.5.0.sql.gz` (hora local).
- `selectBackupsToDelete(files: string[], keep = 30): string[]`: solo considera archivos `gt-prod-*.sql.gz` y devuelve los más viejos que exceden `keep`, según la fecha del nombre.
- `checkDeployPreconditions({ version, releaseExists, imagesExist, qaVersion }): { ok: boolean, needsConfirm: boolean, reason?: string }`.
- `composeArgs(env: 'qa' | 'prod', ...rest: string[]): string[]` → `['compose', '-p', 'gt-<env>', '--env-file', 'deploy/<env>.env', '-f', 'deploy/compose.yaml', ...rest]`.
- `confirmWord(answer: string, expected: 'qa' | 'prod'): boolean`: compara exacto, sin tolerar espacios ni mayúsculas.

- [ ] **Step 1: tests que fallan** en `lib.test.mjs`, como mínimo:
  - `parseVersion('v1.5.0') === '1.5.0'`; `parseVersion('1.5')` lanza error.
  - `backupFileName('1.5.0', new Date(2026, 10, 1, 9, 5, 7)) === 'gt-prod-20261101-090507-v1.5.0.sql.gz'`.
  - Con 32 backups y `keep = 30` se devuelven los 2 más viejos; `notas.txt` y `gt-qa-x.sql.gz` se ignoran.
  - `checkDeployPreconditions`:
    - `releaseExists: false` → `ok: false` (Review Focus 5).
    - `imagesExist: false` → `ok: false`.
    - `qaVersion: '1.4.1'` con version `1.5.0` → `ok: true, needsConfirm: true`.
    - `qaVersion: '1.5.0'` → `needsConfirm: false`.
  - `composeArgs('prod', 'up', '-d')` empieza con `['compose', '-p', 'gt-prod']`.
  - `confirmWord('prod ', 'prod') === false`; `confirmWord('prod', 'prod') === true`.

  Correr `node --test deploy/scripts/test/`. Esperado: FAIL (no existe `lib.mjs`).
- [ ] **Step 2:** implementar `lib.mjs`. Correr de nuevo: PASS.
- [ ] **Step 3:** `deploy/compose.yaml`:
  - **Servicios:**
    - `db`: `postgres:17.6-alpine` o la `17.x` vigente al ejecutar, sin `init.sql`; healthcheck `pg_isready`; `ports: ${DB_PUBLISH:-}` (QA publica `127.0.0.1:5434:5432`, prod no publica nada).
    - `backend`: `ghcr.io/ferrazp/games-tracker-backend:${IMAGE_TAG}`; `env_file` del ambiente; `DB_HOST=db`; `NODE_ENV=production`; sin `ports`.
    - `frontend`: `ghcr.io/ferrazp/games-tracker-frontend:${IMAGE_TAG}`; `ports: "${FRONT_PORT}:80"`.
  - **Volumen:** `db_data` con `name: ${DB_VOLUME}` y `external: ${DB_VOLUME_EXTERNAL:-false}`. Si Compose no acepta interpolar `external`, usar un override `deploy/compose.prod.yaml` que solo declare `external: true` y que `composeArgs('prod', …)` agregue con `-f`; ajustar el test de `composeArgs` en consecuencia.
  - Los puertos no publicados se resuelven con overrides por ambiente si `ports` vacío no es válido.
- [ ] **Step 4:** `qa.env.example` y `prod.env.example` con:
  - `IMAGE_TAG`, `FRONT_PORT` (8081 / 8080), `DB_VOLUME`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
  - `JWT_SECRET` (comentario con el comando para generarlo), `ADMIN_USER`, `ADMIN_PASS`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`.
  - `FRONTEND_URL=http://localhost:<puerto>` y `BACKUP_DIR` (solo en prod).

  Crear los `deploy/qa.env` y `deploy/prod.env` reales con secretos generados (`crypto.randomBytes(48)`); el usuario define `ADMIN_PASS` y las credenciales de Twitch. Nunca se commitean.
- [ ] **Step 5:** `qa.mjs` (`up [--tag X]`, `down`, `reset`) y `prod.mjs` (`deploy <v>`, `backup`, `restore <archivo>`, `rollback`, `status`), usando `lib.mjs` y `spawnSync('docker', …)`.
  - `prod deploy`:
    1. `gh release view v<v> --repo ferrazp/games-tracker` + `docker manifest inspect` de las 2 imágenes.
    2. `checkDeployPreconditions`.
    3. Crear el volumen si falta (`docker volume create gt-prod_db_data`).
    4. Backup, si ya hay datos.
    5. Escribir `IMAGE_TAG=<v>` en un entorno temporal o pasarlo por `env` del proceso; `pull`; `up -d`.
    6. Esperar el healthcheck (máximo 90 s).
    7. Agregar a `deploy/.prod-version` una línea `<v> <backupFile>`, para que `rollback` sepa a qué volver y qué restaurar.
  - `prod backup` (y el backup automático de `deploy`) borra al final los archivos que devuelve `selectBackupsToDelete(readdir(BACKUP_DIR), 30)`.
  - `qa up` escribe `deploy/.qa-version`.
- [ ] **Step 6: smoke de QA con imágenes locales.** `docker tag gt-backend:local ghcr.io/ferrazp/games-tracker-backend:local` (ídem frontend), y luego `npm run qa:up -- --tag local --no-pull` (agregar el flag `--no-pull` a `qa.mjs`).
  Esperado:
  - `http://localhost:8081` carga.
  - `POST http://localhost:8081/api/auth/login` devuelve un token.
  - `GET /api/games` responde 200.
  - Un `POST /api/games` con un JSON de imagen de 2 MB responde 201, no 413 (Review Focus 4).
  - `docker ps` muestra que no hay puerto 4000 publicado.
- [ ] **Step 7: smoke de protección de volumen.** `docker volume create gt-prodtest_db_data`, levantar el compose de prod con `-p gt-prodtest` y `DB_VOLUME=gt-prodtest_db_data`, y después `docker compose -p gt-prodtest … down -v`. Esperado: `docker volume ls` sigue mostrando `gt-prodtest_db_data` (Review Focus 2). Limpiar con `docker volume rm gt-prodtest_db_data`.
- [ ] **Step 8:** `npm run qa:reset` (escribiendo `qa`). Esperado: `gt-qa_db_data` desaparece y ningún volumen `gt-prod*` se toca.
- [ ] **Step 9:** borrar los compose viejos y `nginx.prod.conf`; buscar referencias (`grep -rn "docker-compose\|nginx.prod" apps docs`) y actualizarlas. Escribir `docs/OPERACION.md` con todos los comandos.
- [ ] **Step 10:** `npm test` en la raíz en verde. Commit `feat: isolated QA/prod docker environments with backup, restore and rollback`.

### Task 6: Publicar, configurar GitHub y primer release v1.5.0 🔒

- [ ] **Step 1:** actualizar el `AGENTS.md` raíz (estructura nueva, comandos, flujo GitHub Flow), los `AGENTS.md` de cada app (rutas) y las skills `.opencode` de git-flow (reescribirlas a GitHub Flow o eliminarlas). Commit `docs: update agents docs for monorepo and GitHub Flow`.
- [ ] **Step 2 🔒:** push de `feat/ci-release-deploy` y `gh pr create --title "feat: CI, automated releases and isolated QA/prod environments"`. Esperado: checks `ci` y título del PR en verde.
- [ ] **Step 3 🔒 (lo hace el usuario):** crear el fine-grained PAT (instrucciones en `CONTRIBUTING.md`) y cargarlo con `! gh secret set RELEASE_PLEASE_TOKEN --repo ferrazp/games-tracker`.
- [ ] **Step 4 🔒:** unir el PR #2 con `gh pr merge --squash --delete-branch`. Después configurar el repo:
  - `gh repo edit ferrazp/games-tracker --enable-squash-merge --enable-merge-commit=false --enable-rebase-merge=false --delete-branch-on-merge`.
  - Título del commit = título del PR: `gh api -X PATCH repos/ferrazp/games-tracker -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY`.
  - Ruleset sobre `main` vía `gh api repos/ferrazp/games-tracker/rulesets`: `pull_request` (0 aprobaciones), `required_status_checks` (`ci`), `required_linear_history`, `non_fast_forward` y `deletion`, sin `bypass_actors`.
  - Activar CodeQL default setup y secret scanning con push protection (`gh api -X PATCH repos/... security_and_analysis`).
- [ ] **Step 5:** verificar:
  - El workflow de release-please abrió el PR `chore(main): release 1.5.0` y ese PR corrió `ci` (prueba de que el PAT funciona).
  - `images.yml` publicó `:main`.
  - Un `git push origin main` directo es rechazado.
- [ ] **Step 6 🔒:** unir el PR de release. Después, PR `chore: drop last-release-sha from release-please config`. Esperado: tag `v1.5.0`, GitHub Release con notas, imágenes `:1.5.0` en GHCR (`docker manifest inspect ghcr.io/ferrazp/games-tracker-backend:1.5.0`) y los tres `package.json` en `1.5.0`.

### Task 7: Desplegar QA y Prod v1.5.0 y migrar los datos 🔒

- [ ] **Step 1:** `npm run qa:up -- --tag 1.5.0`. Si en `ELECCION.txt` el usuario eligió una BD de QA, restaurarla con `gunzip -c <dump> | docker compose -p gt-qa … exec -T db psql -U <user> <db>`. Abrir `http://localhost:8081`, loguearse y ver los juegos. El badge muestra v1.5.0 en front y back.
- [ ] **Step 2 🔒:** `npm run prod:deploy -- 1.5.0`. Prod arranca vacío: el backend crea el esquema.
- [ ] **Step 3 🔒:** si `ELECCION.txt` indica una fuente de prod, restaurarla con `npm run prod:restore -- <dump>` (escribiendo `prod`). Comparar los conteos de `games`, `consoles`, `game_catalog` y `game_wishlist` contra la tabla de la Tarea 1: deben coincidir exactamente.
- [ ] **Step 4:** `npm run prod:backup` y `npm run prod:status`. Esperado: un archivo nuevo en `BACKUP_DIR`; el status muestra v1.5.0, los contenedores healthy y el último backup.
- [ ] **Step 5:** ensayo de rollback en QA (no en prod): `qa:up --tag main` y después `qa:up --tag 1.5.0`, comprobando que los datos persisten entre versiones.

### Task 8: Limpieza final 🔒

- [ ] **Step 1 🔒:** en `ferrazp/games-tracker-front`, commit en `main` con un README que diga "Movido a https://github.com/ferrazp/games-tracker (apps/frontend)", push y `gh repo archive ferrazp/games-tracker-front --yes`.
- [ ] **Step 2 🔒:** borrar la rama remota `develop` en `ferrazp/games-tracker` (`git push origin --delete develop`) y las ramas `hotfix/*` o `release/*` remotas que queden.
- [ ] **Step 3:** listarle al usuario, **sin borrar**:
  - los contenedores viejos (`games_tracker_db`, `games_tracker_backend_prod`, `games_tracker_frontend_prod`);
  - los volúmenes viejos (`games-tracker-backend_postgres_data`, `games-tracker-backend_postgres_dev_data`, `games_tracker_dev_postgres_dev_data`);
  - las carpetas `F:\projects\developments\games-tracker` y `games-tracker-backend`;
  - el comando para borrar cada cosa cuando el usuario lo decida.
- [ ] **Step 4:** primera prueba del flujo nuevo: rama `docs/proximos-pasos`, actualizar `apps/backend/docs/proximos-pasos/AGENTS.md` (marcar este trabajo), PR con título `docs: update next steps after monorepo migration` y squash merge. Esperado: release-please actualiza su PR sin subir la versión, porque `docs` está oculto.
