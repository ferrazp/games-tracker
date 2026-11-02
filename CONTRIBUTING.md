# Cómo trabajar en Games Tracker

## Flujo: GitHub Flow

- `main` es la única rama permanente y siempre está lista para publicar. Está protegida: no se hace push directo.
- Todo cambio va en una rama corta desde `main`: `<tipo>/<descripción-corta>`, por ejemplo `feat/notas-por-juego`, `fix/login-expirado`, `docs/operacion`.
- Se abre un PR contra `main`. El check `ci` tiene que estar en verde.
- Se une con **squash merge** (único método habilitado). El título del PR pasa a ser el mensaje del commit en `main`, por eso tiene que cumplir Conventional Commits; lo valida el check *PR title*.
- La rama se borra sola después del merge.

```bash
git switch main && git pull
git switch -c feat/mi-cambio
# ...commits...
git push -u origin feat/mi-cambio
gh pr create --fill
gh pr merge --squash --auto   # se une cuando el CI pase
```

## Mensajes de commit: Conventional Commits

`<tipo>(<alcance opcional>): <descripción en imperativo>`. El hook `commit-msg` (husky + commitlint) los valida localmente.

| Tipo | Cuándo | Efecto en la versión |
|---|---|---|
| `feat` | funcionalidad nueva | minor (1.5.0 → 1.6.0) |
| `fix` | corrección de bug | patch (1.5.0 → 1.5.1) |
| `perf` | mejora de rendimiento | patch |
| `feat!` / `BREAKING CHANGE:` en el cuerpo | cambio incompatible | major |
| `docs`, `chore`, `refactor`, `test`, `ci`, `build` | todo lo demás | ninguno (no aparece en el changelog) |

Ejemplos:

```
feat(games): add personal notes per game
fix(auth): redirect to login when the token expires
docs: explain QA reset
chore(deps): bump vite to 7.4
```

Alcances habituales: `backend`, `frontend`, `games`, `wishlist`, `auth`, `deploy`, `ci`.

## Versiones y releases (release-please)

- Hay **una sola versión** para toda la app (SemVer). La comparten el `package.json` raíz y los de `apps/backend` y `apps/frontend`.
- Con cada merge a `main`, release-please mantiene abierto un PR `chore(main): release X.Y.Z` con el `CHANGELOG.md` y la versión calculados a partir de los commits.
- **Para publicar un release, se une ese PR.** Eso crea el tag `vX.Y.Z`, el GitHub Release con las notas, y construye las imágenes `:X.Y.Z` en GHCR.
- No se edita la versión a mano ni se crean tags a mano.

### Token `RELEASE_PLEASE_TOKEN`

release-please usa un token personal (fine-grained) para que su PR dispare el CI (con el `GITHUB_TOKEN` por defecto no lo haría).

Crearlo o renovarlo:

1. GitHub → *Settings* → *Developer settings* → *Personal access tokens* → *Fine-grained tokens* → *Generate new token*.
2. *Repository access*: **Only select repositories** → `ferrazp/games-tracker`.
3. *Permissions* → *Repository permissions*: **Contents: Read and write** y **Pull requests: Read and write**.
4. Expiración: 1 año (anotá la fecha para renovarlo).
5. Cargarlo en el repo: `gh secret set RELEASE_PLEASE_TOKEN --repo ferrazp/games-tracker` y pegar el token.

Si vence, el workflow *Release* falla con un error de autenticación: se repiten los pasos y se vuelve a correr.

## Ambientes

| | Dev | QA | Prod |
|---|---|---|---|
| Qué corre | código local (`npm run dev`) | imagen `:main`, `:sha-xxx` o `:X.Y.Z` | imagen `:X.Y.Z` (solo releases) |
| BD | SQLite local (`apps/backend/games.db`) | Postgres propio | Postgres propio |
| Proyecto compose | — | `gt-qa` | `gt-prod` |
| Frontend | `http://localhost:3000` | `http://localhost:8081` | `http://localhost:8090` |
| API publicada | `:4000` | no (solo `/api` a través del front) | no (solo `/api` a través del front) |
| Postgres publicado | — | `127.0.0.1:5434` | no publicado |
| Archivo de entorno | `apps/backend/.env` | `deploy/qa.env` | `deploy/prod.env` |
| Volumen de datos | archivo | `gt-qa_db_data` (normal) | `gt-prod_db_data` (external) |
| Se puede borrar | sí | sí, con `npm run qa:reset` | nunca por comando automático |

Promoción: release `vX.Y.Z` → `npm run qa:up -- --tag X.Y.Z` → probar → `npm run prod:deploy -- X.Y.Z`. Los comandos de operación están en [`docs/OPERACION.md`](docs/OPERACION.md).

## Dev local

```bash
npm install          # instala todos los workspaces
npm run dev          # API en :4000 y front en :3000
npm test             # tests de backend, frontend y scripts de deploy
npm run build        # build del front
```
