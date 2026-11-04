# Games Tracker Frontend

Frontend web de **Games Tracker**: registro personal de videojuegos jugados. Es el workspace `games-tracker` del monorepo.

## Stack

- **React 19** con **Vite 8** (sin router: las pestañas las maneja `App.jsx`)
- **Vitest** + Testing Library para los tests
- **Docker + nginx** en QA y Prod (nginx sirve el build y hace de proxy de `/api` al backend)

## Desarrollo

Desde la raíz del monorepo:

```bash
npm install
npm run dev               # API :4000 + front :3000
npm test -w games-tracker # tests del front
npm run build             # build de producción (apps/frontend/dist)
```

La URL del backend se configura con `VITE_API_URL` (por defecto `http://localhost:4000`).

### Docker

La imagen se construye desde la raíz del monorepo y llama a la API por `/api`:

```bash
docker build -f apps/frontend/Dockerfile -t ghcr.io/ferrazp/games-tracker-frontend:local .
```

Para levantarla junto al backend y Postgres, ver [`docs/OPERACION.md`](../../docs/OPERACION.md).

## Estructura

```
src/
├── App.jsx                 # Pestañas (juegos, próximos, sagas), sesión y paneles laterales
├── api.js                  # apiFetch: maneja la sesión vencida
├── config.js               # URL de la API y versión
└── components/
    ├── GameForm.jsx        # Agregar y editar juegos (búsqueda en catálogo e IGDB)
    ├── GameList.jsx        # Juegos registrados con filtros
    ├── Wishlist.jsx        # Próximos juegos, reordenables
    ├── SidePanels.jsx      # Portadas de los costados (de las sagas cuando se está en Sagas)
    ├── Login.jsx  VersionBadge.jsx  ConsoleImage.jsx
    └── sagas/
        ├── Sagas.jsx           # Lista de sagas con su avance
        ├── SagaDetail.jsx      # Grilla por año: jugados a color, faltantes en gris, menú ⋯ (archivar)
        ├── SuggestPanel.jsx    # Dónde jugar un juego faltante
        ├── LinkPanel.jsx       # Unir versiones de un juego (⭐ principal) y separarlas
        └── UnresolvedGames.jsx # Elegir el juego correcto cuando IGDB es ambiguo
```

Cada componente tiene su `*.test.jsx` al lado. Endpoints que usa cada uno: [`AGENTS.md`](AGENTS.md).
