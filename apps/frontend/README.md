# Games Tracker Frontend

Frontend web para **Games Tracker** — aplicación personal para tracking de videojuegos jugados.

## Stack

- **React** (Create React App)
- **React Router** — navegación
- **Context API** — estado global
- **Docker + Nginx** — producción

## Requisitos

- Node.js 18+
- npm
- Backend corriendo en `http://localhost:4000`

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000).

La URL del backend se configura vía `REACT_APP_API_URL` en `.env` (por defecto `http://localhost:4000`).

## Producción

```bash
npm run build
```

Genera los archivos estáticos en `build/`.

### Docker

La imagen se construye desde la raíz del monorepo y llama a la API por `/api` (su nginx hace de proxy al backend):

```bash
docker build -f apps/frontend/Dockerfile -t ghcr.io/ferrazp/games-tracker-frontend:local .
```

Para levantarla junto al backend y Postgres, ver [`docs/OPERACION.md`](../../docs/OPERACION.md).

## Estructura

```
src/
├── components/
│   ├── GameForm.js     # Formulario para agregar/editar juegos
│   ├── GameList.js     # Listado de juegos registrados
│   └── Login.js        # Pantalla de login
├── config.js           # Configuración de API
├── App.js              # Componente principal
└── index.js            # Entry point
```

## Licencia

MIT
