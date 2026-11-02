# AGENTS.md — Games Tracker (monorepo)

Registro personal de videojuegos jugados. Un solo repo (`ferrazp/games-tracker`) con backend y frontend, una sola versión SemVer, y dos ambientes Docker aislados (QA y Prod) en la PC del usuario.

## Estructura

```
games-tracker/                 F:\projects\developments\games-tracker-monorepo
├── apps/
│   ├── backend/               Express 5 + SQLite/Postgres (workspace "games-backend") — ver apps/backend/AGENTS.md
│   └── frontend/              React 19 + Vite 7 (workspace "games-tracker") — ver apps/frontend/AGENTS.md
├── deploy/
│   ├── compose.yaml           base de QA y Prod (+ compose.qa.yaml / compose.prod.yaml)
│   ├── qa.env.example         → deploy/qa.env   (no se commitea)
│   ├── prod.env.example       → deploy/prod.env (no se commitea)
│   └── scripts/               qa.mjs, prod.mjs, lib.mjs (lógica pura con tests en test/)
├── docs/
│   ├── OPERACION.md           cómo operar QA y Prod (deploy, backup, restore, rollback)
│   └── superpowers/           specs y planes de diseño
├── .github/workflows/         ci, pr-title, release-please, images
├── CONTRIBUTING.md            flujo de trabajo, commits, releases, token
└── package.json               workspaces y scripts raíz
```

## Comandos (siempre desde la raíz)

| Comando | Qué hace |
|---|---|
| `npm install` | Instala todos los workspaces (un solo `package-lock.json`) |
| `npm run dev` | API en `:4000` (SQLite) y front en `:3000` |
| `npm test` | Tests de backend (`node --test`), frontend (Vitest) y `deploy/scripts` |
| `npm run build` | Build del front |
| `npm run qa:up -- --tag <main\|sha-xxx\|X.Y.Z>` | QA en `http://localhost:8081` |
| `npm run qa:reset` | Borra QA y sus datos (pide escribir `qa`) |
| `npm run prod:deploy -- X.Y.Z` | Despliega un release en `http://localhost:8080` |
| `npm run prod:status` / `prod:backup` / `prod:restore` / `prod:rollback` | Ver `docs/OPERACION.md` |

Para un solo workspace: `npm test -w games-backend`, `npm test -w games-tracker`.

## Flujo de trabajo: GitHub Flow

- `main` protegida; todo entra por PR con el check `ci` en verde y **squash merge**.
- Ramas cortas desde `main`: `<tipo>/<descripción>` (`feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`, `ci/`).
- Commits y título de PR en **Conventional Commits** (lo validan husky + commitlint y el check *PR title*).
- Versionado y changelog automáticos con **release-please**: se publica uniendo el PR `chore(main): release X.Y.Z`. No editar versiones ni crear tags a mano.
- No existen `develop`, `release/*` ni `hotfix/*`: un hotfix es un `fix:` normal.

Detalle completo: [CONTRIBUTING.md](CONTRIBUTING.md).

## Reglas para agentes

- No commitear `.env`, `deploy/*.env`, `deploy/.prod-version`, `deploy/.qa-version` ni `*.db`.
- Nunca borrar el volumen `gt-prod_db_data` ni correr `prod:restore` / `prod:rollback` sin pedido explícito del usuario.
- Antes de push, merge, release o deploy a prod, confirmar con el usuario.
- Cambios de comportamiento: test primero (TDD), `npm test` en verde antes del PR.
