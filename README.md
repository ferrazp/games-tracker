# 🎮 Games Tracker

Registro personal de los videojuegos que jugué en mi vida: qué jugué, en qué consola, cuándo lo empecé y terminé, cuántas horas le dediqué, y una lista de deseos. Con un catálogo precargado desde IGDB (+7800 juegos) para buscar y agregar rápido.

[![CI](https://github.com/ferrazp/games-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/ferrazp/games-tracker/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ferrazp/games-tracker)](https://github.com/ferrazp/games-tracker/releases)

## Qué hay en este repo

| | |
|---|---|
| [`apps/backend`](apps/backend) | API REST — Node 24, Express 5, PostgreSQL 17 (SQLite en desarrollo), JWT, IGDB/Twitch |
| [`apps/frontend`](apps/frontend) | Web — React 19 + Vite 7 |
| [`deploy`](deploy) | Docker Compose de QA y Producción y scripts de operación (deploy, backup, restore, rollback) |
| [`docs`](docs) | [Operación](docs/OPERACION.md), diseño y planes |

Un solo repo y **una sola versión** para toda la app ([SemVer](https://semver.org/lang/es/)), publicada automáticamente con [release-please](https://github.com/googleapis/release-please). Las imágenes Docker de cada versión están en GHCR: `ghcr.io/ferrazp/games-tracker-backend` y `ghcr.io/ferrazp/games-tracker-frontend`.

## Ambientes

| | Dev | QA | Producción |
|---|---|---|---|
| Para qué | programar | probar una versión antes de usarla | registrar mis juegos de verdad |
| Web | http://localhost:3000 | http://localhost:8081 | http://localhost:8090 |
| Qué corre | el código local | una imagen publicada (`:main` o `:X.Y.Z`) | solo releases (`:X.Y.Z`) |
| Datos | SQLite local | Postgres propio, descartable | Postgres propio, con backups |

QA y Producción corren en Docker en la misma PC pero totalmente aislados: contenedores, red, base de datos y credenciales propias. Los datos de producción viven en un volumen que ningún comando borra.

## Uso diario

En Windows, el acceso directo **Games Tracker** del escritorio abre un menú para levantar y bajar cada ambiente y abrir la web (`npm run shortcut` lo crea). Lo mismo por línea de comandos, desde la raíz:

```bash
npm run prod:start        # levantar producción (http://localhost:8090)
npm run prod:stop         # bajarla (los datos quedan)
npm run prod:backup       # backup ahora (se guardan los últimos 30)
npm run qa:up -- --tag main
npm run dev               # API :4000 + web :3000
```

Publicar una versión nueva en producción: [`docs/OPERACION.md`](docs/OPERACION.md#ciclo-de-un-release).

## Desarrollo

Requisitos: Node 24 (`.nvmrc`), Docker Desktop para QA y Producción.

```bash
git clone https://github.com/ferrazp/games-tracker.git
cd games-tracker
npm install
cp apps/backend/.env.example apps/backend/.env
npm run dev
npm test                  # backend, frontend y scripts de deploy
```

Flujo de trabajo (GitHub Flow, Conventional Commits, releases automáticos): [`CONTRIBUTING.md`](CONTRIBUTING.md).
