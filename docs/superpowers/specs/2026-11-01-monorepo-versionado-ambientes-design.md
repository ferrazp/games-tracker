# Diseño: monorepo, versionado y ambientes aislados (QA / Producción)

- **Fecha:** 2026-11-01
- **Estado:** listo para aprobación
- **Repos afectados:** `ferrazp/games-tracker` (backend, pasa a ser el monorepo) y `ferrazp/games-tracker-front` (frontend, se archiva)

---

## 1. Intención y por qué

Games Tracker es un proyecto personal para registrar lo que el usuario jugó en su vida y sus avances. Todo corre en su PC (Windows 11 + Docker Desktop). Está por empezar a cargar datos reales en producción, y **esos datos son lo único irreemplazable del proyecto**.

Quiere dos cosas:

1. **Aislamiento real de ambientes:** poder borrar dev o QA por completo sin ningún riesgo para producción.
2. **Versionado y forma de trabajo en git/GitHub según las prácticas actuales de la industria:** ramas, PRs, versionado semántico, changelog y releases.

### Problemas actuales que motivan el cambio

| Problema | Detalle |
|---|---|
| Prod no tiene BD propia | `docker-compose.prod.yml` no define postgres: usa el servicio `postgres` de `docker-compose.yml`. La BD `games_tracker_prod` vive en el mismo servidor y el mismo volumen (`postgres_data`) que la BD `games_tracker` del perfil por defecto. Un `down -v` en el lugar equivocado borra las dos. |
| Puertos en conflicto | El backend de dev y el de prod publican el puerto `4001`: no pueden correr a la vez. |
| Mismas credenciales | Los tres perfiles usan `postgres/postgres`. |
| Prod corre "lo que haya en la carpeta" | Las imágenes se construyen localmente desde el código del momento, sin tag de versión. Reconstruir prod estando en otra rama despliega esa rama. |
| Front y back acoplados en dos repos | Cada feature son dos ramas, dos PRs y dos bumps de versión a mano, que se mantienen sincronizados manualmente. El compose del back depende de `../games-tracker`. |
| Git Flow + bump manual | Ramas `develop`/`release/*`/`hotfix/*`, bump y CHANGELOG manuales, tags de prueba `-dev.N`. No hay CI ni protección de ramas. |
| Front con URL de API fija en la imagen | `VITE_API_URL` se mete en el build, así que la imagen del front es distinta para cada ambiente y no se puede promover la misma imagen de QA a prod. |

---

## 2. Objetivos, no objetivos y antiobjetivos

### Objetivos
- Un único repo (monorepo) con **una sola versión** para toda la app.
- **GitHub Flow:** `main` es la única rama permanente; cambios vía PR con squash merge.
- **Conventional Commits** validados automáticamente.
- **Versionado SemVer, CHANGELOG, tag y GitHub Release automáticos** con release-please.
- **CI** en GitHub Actions: tests y build en cada PR; `main` protegida.
- **Imágenes Docker versionadas** publicadas en GHCR.
- **QA y Prod como dos instalaciones Docker totalmente aisladas** en la misma PC: BD, volumen, red, puertos, credenciales y archivo de entorno propios.
- **A prod solo llega una versión etiquetada** (imagen `X.Y.Z`); nunca código sin release.
- **Backup automático de prod antes de cada despliegue**, más un script de restauración.
- Comandos simples para operar: levantar/resetear QA, desplegar/respaldar/restaurar prod.

### No objetivos (fuera de este proyecto)
- Unificar el esquema de BD (`database.js` / `init.sql` / `migrations/`) y eliminar el SQL duplicado SQLite/PG: es el refactor del punto 10 del RE, va aparte.
- Agregar ESLint/linters con reglas nuevas y corregir el código para cumplirlas (se deja como follow-up; el CI queda preparado para sumar un job).
- Despliegue en la nube, multiusuario, Kubernetes.
- Funcionalidades nuevas (notas por juego, etc.).

### Antiobjetivos (sería un fracaso aunque "funcione")
- Cualquier paso que pueda perder o mezclar datos de producción, incluida la migración misma.
- Que prod pueda terminar corriendo código sin tag de release.
- Un proceso más pesado del que tolera un desarrollador solo (por ejemplo, exigir aprobaciones de PR que nadie más puede dar).
- Perder el historial de git de cualquiera de los dos repos.

---

## 3. Restricciones

- Windows 11, PowerShell 7 y Git Bash; Docker Desktop. Los scripts operativos deben funcionar en Windows (preferir Node `.mjs` antes que bash/PowerShell).
- Node 20+ (los Dockerfiles usan `node:20-slim`); npm como gestor de paquetes (sin agregar pnpm/turbo).
- Los dos repos son **públicos**: GHCR, CodeQL y secret scanning son gratuitos. Las imágenes no deben contener secretos (todo por variables de entorno en runtime).
- Usuario de GitHub: `ferrazp`; `gh` CLI ya autenticado.
- Los secretos (`.env`, `*.env` de ambientes) nunca se commitean.

---

## 4. Decisiones

> Leyenda: **[Usuario]** = lo decidió el usuario. **[Claude]** = decisión mía, a revisar.

### 4.1 Paso previo: cerrar v1.4.1 en los dos repos
- **[Claude]** Antes de unir, terminar el hotfix `v1.4.1` ya implementado en ambos repos (`git flow hotfix finish`), con push de `main`, `develop` y tags. Es la última release con Git Flow y en dos repos.
- **[Claude]** Producción no se redespliega con 1.4.1 en el esquema viejo: el primer despliegue de prod ya es con el esquema nuevo (sección 4.6).

### 4.2 Monorepo
- **[Usuario]** Un solo repo con una única versión para toda la app.
- **[Claude]** El monorepo es `ferrazp/games-tracker` (el repo actual del backend, que ya tiene el nombre correcto). `ferrazp/games-tracker-front` se **archiva** (solo lectura, no se borra) con un README que apunta al monorepo.
- **[Claude]** Se conserva el **historial completo** de ambos repos: cada uno se reescribe a su subcarpeta con `git filter-repo --to-subdirectory-filter` y se une con `git merge --allow-unrelated-histories`. Se trabaja sobre clones nuevos; los repos originales quedan intactos hasta verificar el resultado.
- **[Claude] Tags antiguos:** los del backend (`v1.0.0` … `v1.4.1`) quedan como están. Los del frontend se importan con prefijo `frontend/` (por ejemplo `frontend/v1.4.0`) para no chocar. Los tags `-dev.N` de ambos se eliminan (eran de prueba).
- **[Claude] Primera versión del monorepo: `v1.5.0`.**
- **[Claude]** Las ramas `develop`, `release/*` y `hotfix/*` se eliminan local y remotamente al terminar la migración.

**Estructura propuesta** **[Claude]**:

```
games-tracker/
├── apps/
│   ├── backend/            # ex games-tracker-backend (código, tests, Dockerfile)
│   └── frontend/           # ex games-tracker (código, tests, Dockerfile, nginx.conf)
├── deploy/
│   ├── compose.yaml        # UN compose parametrizado para QA y Prod
│   ├── qa.env.example
│   ├── prod.env.example
│   └── scripts/            # qa.mjs, prod.mjs (deploy/backup/restore) en Node
├── docs/                   # documentación general (la de cada app queda en apps/*/docs)
├── .github/
│   ├── workflows/          # ci.yml, pr-title.yml, release-please.yml, images.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── package.json            # npm workspaces + scripts raíz; versión única de la app
├── release-please-config.json
├── .release-please-manifest.json
├── commitlint.config.js
├── CHANGELOG.md            # único, generado por release-please desde v1.5.0
├── CONTRIBUTING.md         # forma de trabajo (sección 4.3)
└── AGENTS.md               # índice para agentes, actualizado a la estructura nueva
```

- **[Claude]** npm workspaces (`"workspaces": ["apps/*"]`), con un solo `package-lock.json` en la raíz. Scripts raíz: `npm test` (corre ambos), `npm run build`, `npm run dev` (back con SQLite y front con Vite en paralelo).
- **[Claude]** Los `CHANGELOG.md` viejos de cada app se mueven a `apps/*/CHANGELOG.legacy.md` como historia; el CHANGELOG raíz arranca en v1.5.0.

### 4.3 Forma de trabajo en git / GitHub
- **[Claude] GitHub Flow:**
  1. Rama corta desde `main`: `<tipo>/<descripcion-corta>` (`feat/notas-juego`, `fix/paginacion`, `chore/deps`, `docs/...`).
  2. Commits con Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `perf:`; `!` o `BREAKING CHANGE:` para cambios incompatibles). Scope opcional: `feat(frontend): ...`, `fix(backend): ...`, `ci: ...`.
  3. PR a `main`. **El título del PR debe ser un Conventional Commit**: con squash merge, ese título pasa a ser el commit en `main`, y es lo que lee release-please.
  4. CI en verde → **squash merge** → la rama se borra sola.
- **[Claude] Validación:** el título del PR se valida en CI (`amannn/action-semantic-pull-request`); localmente, un hook `commit-msg` con husky + commitlint (`@commitlint/config-conventional`) avisa antes de pushear.
- **[Claude] Configuración del repo:** solo squash merge (merge commit y rebase deshabilitados), "usar título del PR como mensaje", borrar ramas al hacer merge, default branch `main`.
- **[Claude] Ruleset sobre `main`:**
  - PR obligatorio, con **0 aprobaciones requeridas** (dev solo).
  - Checks de CI obligatorios.
  - Historial lineal.
  - Prohibidos el force-push y el borrado.
  - Sin bypass para nadie (los PRs de release-please también pasan por CI).
- **[Claude]** Plantilla de PR corta: qué cambia, cómo se probó, checklist.
- **[Claude]** `CONTRIBUTING.md` documenta todo el flujo con ejemplos de comandos.
- **[Claude]** Las skills de `.opencode` que describen Git Flow (`git-flow-workflow`, `gitflow-proximo-paso`) se actualizan a GitHub Flow, o se eliminan si quedan sin propósito.

### 4.4 Versionado y releases
- **[Claude] SemVer** con una única versión de la app, en el `package.json` raíz y replicada en `apps/backend/package.json` y `apps/frontend/package.json` (así `/version` y el `VersionBadge` siguen funcionando).
- **[Claude] release-please** (`googleapis/release-please-action`), modo un solo paquete en la raíz (`release-type: node`), con `extra-files` para actualizar los `package.json` de las apps:
  - Cada merge a `main` actualiza un "PR de release" con la próxima versión y el CHANGELOG.
  - `feat` → minor, `fix` → patch, `!` → major.
  - Al mergear el PR de release: tag `vX.Y.Z` + GitHub Release con las notas.
- **[Claude]** Se eliminan los bumps manuales y los tags `-dev.N`. Si alguna vez hace falta un pre-release, se usa la configuración de prerelease de release-please, no tags a mano.

### 4.5 CI/CD (GitHub Actions)
- **Token de release-please:** los PRs y tags que crea un workflow con el `GITHUB_TOKEN` por defecto no disparan otros workflows. Sin otro token, el PR de release no tendría CI (y el ruleset no lo dejaría mergear) y el tag no publicaría las imágenes. → **[Usuario]** Se usa un **fine-grained PAT**:
  - Lo crea el usuario en GitHub, con alcance solo sobre `ferrazp/games-tracker` y permisos *Contents: Read and write* y *Pull requests: Read and write*.
  - Se guarda como secreto del repo `RELEASE_PLEASE_TOKEN`; `release-please.yml` lo usa en lugar del `GITHUB_TOKEN`.
  - Así el PR de release corre CI como cualquier otro y el tag dispara `images.yml`.
  - `CONTRIBUTING.md` documenta cómo crearlo y renovarlo. **[Claude]** Si el token vence, release-please falla con un error visible en Actions; no se rompe nada más.
- **[Claude] `ci.yml`** (PR y push a `main`):
  - `npm ci` en la raíz.
  - Tests del backend (`node --test`) y del frontend (`vitest run`).
  - Build del frontend.
  - Build de las dos imágenes Docker, sin push, para que un Dockerfile roto falle en el PR.
  - Node 20. Caché de npm.
- **[Claude] `pr-title.yml`:** valida el título del PR.
- **[Claude] `release-please.yml`:** en push a `main`.
- **[Claude] `images.yml`:** publica en GHCR:
  - `ghcr.io/ferrazp/games-tracker-backend`
  - `ghcr.io/ferrazp/games-tracker-frontend`

  Tags de imagen:
  - push a `main` → `:main` y `:sha-<corto>` (los usa QA).
  - release `vX.Y.Z` → `:X.Y.Z`, `:X.Y` y `:latest` (los usa Prod).

  Imágenes públicas, con labels OCI (`org.opencontainers.image.version`, `source`, `revision`).
- **[Claude] Dependabot:** semanal y agrupado, para npm (los dos workspaces), GitHub Actions e imágenes base de Docker.
- **[Claude] Seguridad del repo:** CodeQL (default setup) y secret scanning con push protection (gratis por ser público).

### 4.6 Ambientes aislados en la PC
**Tres ambientes** **[Claude]**:

| | Dev | QA | Prod |
|---|---|---|---|
| Qué corre | código local (`npm run dev`) | imagen `:main` (o `:sha-xxx`) | imagen `:X.Y.Z` (solo releases) |
| BD | SQLite local (`apps/backend/games.db`) | Postgres propio | Postgres propio |
| Proyecto compose | — | `gt-qa` | `gt-prod` |
| Frontend | `http://localhost:3000` | `http://localhost:8081` | `http://localhost:8080` |
| API publicada | `:4000` | no (solo a través del front, en `/api`) | no (solo a través del front, en `/api`) |
| Postgres publicado | — | `127.0.0.1:5434` (para inspeccionar) | **no publicado** |
| Archivo de entorno | `apps/backend/.env` | `deploy/qa.env` | `deploy/prod.env` |
| Volumen de datos | archivo | `gt-qa_db_data` (normal) | `gt-prod_db_data` (**external**) |
| Se puede borrar | sí | sí, con `npm run qa:reset` | nunca por comando automático |

- **[Claude] Un solo `deploy/compose.yaml`** parametrizado, levantado con `docker compose -p <proyecto> --env-file deploy/<amb>.env`. El nombre de proyecto aísla automáticamente contenedores, red y volúmenes.
- **[Claude] Protección de datos de prod:** el volumen de prod se declara `external: true` y lo crea una sola vez el script de prod. Así ni `docker compose down -v` sobre `gt-prod` puede borrarlo. QA usa un volumen normal, borrable.
- **[Claude] Credenciales distintas por ambiente:** usuario/contraseña de Postgres, `JWT_SECRET` y `ADMIN_PASS` propios en cada `*.env`. Prod usa `NODE_ENV=production` y por eso exige secretos fuertes (validación agregada en v1.4.1). QA usa `NODE_ENV=production` también, para probar igual que prod.
- **[Claude] Front con API relativa:**
  - El front se compila con `VITE_API_URL=/api`.
  - El nginx del contenedor del front hace proxy de `/api/*` al servicio `backend` de su propio proyecto compose, quitando el prefijo.
  - Así **la misma imagen sirve para QA y Prod**, front y API son mismo origen y no hay CORS entre ambientes.
  - `nginx.prod.conf` (que solo proxeaba algunas rutas) se reemplaza por este esquema.
  - En dev se mantiene `http://localhost:4000` por defecto.
- **[Claude]** Se eliminan `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml` y `nginx.prod.conf`.
- **[Claude]** Postgres fijado a la versión menor (`postgres:17.x-alpine`), no flotante.
- **[Claude]** `init.sql` deja de montarse en el contenedor de Postgres: el backend ya crea el esquema al arrancar (es idempotente), y hoy `init.sql` está desactualizado. Unificar el esquema sigue siendo un no objetivo.

### 4.6.1 Promoción de una versión: QA → Prod
**[Claude]** Las imágenes `X.Y.Z` se construyen **una vez**, desde el tag del release, así la versión que se ve en `VersionBadge` y en `/version` es la correcta. Esas mismas imágenes se promueven sin recompilar:
1. El release `vX.Y.Z` publica `:X.Y.Z` en GHCR.
2. `npm run qa:up -- --tag X.Y.Z` → se prueba en QA exactamente la imagen del release.
3. `npm run prod:deploy -- X.Y.Z` → la misma imagen pasa a prod.

`:main` y `:sha-xxx` siguen existiendo para probar en QA lo que está en `main` antes de hacer el release. `prod:deploy` avisa (y pide confirmar) si esa versión nunca se levantó en QA; para eso, `qa:up` registra la última versión probada en `deploy/.qa-version`.

### 4.7 Operación (scripts Node en `deploy/scripts`, expuestos como npm scripts raíz)
**[Claude]**
- `npm run qa:up [-- --tag sha-abc1234]`: pull de la imagen (por defecto `:main`) y up de `gt-qa`.
- `npm run qa:down` / `npm run qa:reset` (este último hace `down -v`, pide confirmación y borra solo `gt-qa`).
- `npm run prod:deploy -- 1.5.0`:
  1. Valida que el tag `v1.5.0` exista como GitHub Release y que la imagen exista en GHCR.
  2. Hace backup de prod (si ya existe).
  3. Pull de las imágenes `:1.5.0`.
  4. `up -d` de `gt-prod`.
  5. Espera el healthcheck.
  6. Registra la versión desplegada en `deploy/.prod-version` (gitignored).

  Si el health falla, avisa y propone `prod:rollback`.
- `npm run prod:rollback`: vuelve a la versión anterior (de `deploy/.prod-version`) **y restaura el backup tomado antes de ese deploy**. Las dos cosas van juntas porque el backend aplica cambios de esquema al arrancar, y una imagen vieja sobre un esquema nuevo no está garantizada. Pide confirmación escribiendo "prod". **[Claude]**
- `npm run prod:backup`: `pg_dump` (dentro del contenedor de la BD) → `<BACKUP_DIR>/gt-prod-<fecha>-v<versión>.sql.gz`. Por defecto `BACKUP_DIR=%USERPROFILE%\games-tracker-backups`, fuera del repo. Retiene los últimos 30.
- `npm run prod:restore -- <archivo>`: pide confirmación escribiendo "prod", y antes hace un backup del estado actual.
- `npm run prod:status`: versión desplegada, estado de los contenedores y último backup.
- Se actualiza `docs/BACKUP-VOLUMENES.md` y se agrega `docs/OPERACION.md` con estos comandos.

### 4.8 Migración de datos existentes
**[Claude]**
1. Antes de tocar nada:
   - Para **cada** volumen Postgres existente (`games-tracker-backend_postgres_data`, `games-tracker-backend_postgres_dev_data`, `games_tracker_dev_postgres_dev_data`): levantarlo en un contenedor temporal y hacer `pg_dump` de **todas** sus BDs a `BACKUP_DIR/pre-migracion/<volumen>/`.
   - Mostrarle al usuario una tabla con conteos por volumen y BD: juegos, consolas, catálogo y wishlist.
   - **El usuario elige cuál es la fuente de prod.** Si hay juegos reales en más de una BD, se decide con él (sin fusionar automáticamente).
2. Crear `gt-prod` vacío con v1.5.0.
3. Restaurar en prod la BD que eligió el usuario.
4. Verificar conteos: juegos, consolas, catálogo y wishlist, antes y después.
5. Lo mismo con QA, a partir de la BD de dev (opcional, sirve como datos de prueba).
6. **Los volúmenes y contenedores viejos no se borran.** Se le listan al usuario con el comando para borrarlos cuando lo decida.

---

## 5. Orden de ejecución sugerido

1. Cerrar v1.4.1 en los dos repos (sección 4.1).
2. Backups previos de todos los volúmenes Postgres existentes (4.8.1).
3. Armar el monorepo en una rama `chore/monorepo` de `ferrazp/games-tracker` con el historial unido; verificar que los tests de ambas apps pasen desde la raíz.
4. Agregar CI, release-please, commitlint/husky, Dependabot y la plantilla de PR (4.3 a 4.5).
5. Agregar `deploy/` y los scripts (4.6, 4.7); probar QA de punta a punta con imágenes construidas localmente.
6. Push y PR; CI en verde; merge; configurar el ruleset y las opciones del repo; release-please abre el PR de v1.5.0; mergearlo → imágenes `1.5.0` en GHCR.
7. Desplegar prod v1.5.0 y migrar los datos (4.8); verificar.
8. Archivar `games-tracker-front`, borrar `develop` y las ramas viejas, y actualizar `AGENTS.md`, `CONTRIBUTING.md` y la documentación.

Los pasos que publican o modifican cosas fuera de la PC (push, configurar el repo, archivar, borrar ramas remotas) se confirman con el usuario en el momento.

---

## 6. Qué queda a criterio del implementador
- Detalles de los workflows (nombres de jobs, matrices, versiones exactas de las actions, fijadas a versión mayor o SHA).
- Cómo se reparte la documentación existente entre `docs/` raíz y `apps/*/docs`, siempre que los enlaces queden válidos.
- Implementación interna de los scripts de `deploy/`, siempre que cumplan el comportamiento y las confirmaciones descritas.
- Ajustes menores en los tests o la configuración de Vite/Vitest necesarios para correr desde workspaces.

---

## 7. Decisiones del usuario
1. Un solo repo con una única versión (4.2).
2. Token de release-please: fine-grained PAT `RELEASE_PLEASE_TOKEN` (4.5).

## 8. Decisiones que tomé yo (para revisar)
Todas las marcadas **[Claude]**. Las de más impacto:
1. `ferrazp/games-tracker` como monorepo; el repo del front se archiva.
2. Primera versión unificada `v1.5.0`; tags del front con prefijo `frontend/`; se borran los tags `-dev.N`.
3. Tres ambientes: Dev en SQLite local, QA y Prod en Docker; puertos 8081 (QA) y 8080 (Prod).
4. Prod solo con imágenes de release desde GHCR; QA con `:main`.
5. Volumen de prod `external`; backups fuera del repo con retención de 30.
6. Front con API relativa `/api` vía nginx, para que la misma imagen sirva en los dos ambientes.
7. Se elimina Git Flow y se reemplaza por GitHub Flow con squash merge y 0 aprobaciones requeridas.
8. Las imágenes `X.Y.Z` se construyen una vez desde el tag y se promueven QA → Prod sin recompilar.
9. El rollback de prod restaura imagen anterior + backup previo al deploy, juntos.
10. En la migración, el usuario elige qué BD es la fuente de prod después de ver los conteos.
