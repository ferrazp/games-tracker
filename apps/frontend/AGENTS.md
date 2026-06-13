# 🎮 AGENTS.md - Frontend Games Tracker

## 📋 Visión General

Frontend del gestor personal de videojuegos. Consume la API del backend en `http://localhost:4000`.

- **Framework:** React 19 + Vite
- **Puerto:** 3000
- **Backend:** `F:\projects\developments\games-tracker-backend` (ver AGENTS.md allí)
- **API URL:** Centralizada en `src/config.js` (variable `VITE_API_URL` o default `http://localhost:4000`)

---

## 📂 Estructura

```
games-tracker/
├── index.html                    # Entry point HTML
├── vite.config.js                # Vite + Vitest config
├── public/
│   ├── favicon.ico
│   └── ...                       # Assets estáticos
├── src/
│   ├── config.js                 # API_URL centralizada
│   ├── App.jsx                   # Componente raíz, única fuente de datos
│   ├── App.css                   # Estilos principales (cards, botones, feedback)
│   ├── index.jsx                 # Entry point
│   ├── index.css                 # Estilos globales
│   ├── components/
│   │   ├── GameForm.jsx          # Formulario: crear juego + búsqueda mock local
│   │   ├── GameList.jsx          # Lista con editar/eliminar + estados
│   │   ├── Login.jsx             # Pantalla de login
│   │   └── VersionBadge.jsx      # Versiones frontend/backend
│   └── App.test.jsx              # Test: renderiza "Games Tracker"
├── package.json
└── AGENTS.md
```

---

## 🚀 Quick Start

```powershell
cd F:\projects\developments\games-tracker
npm start                       # Inicia Vite dev en http://localhost:3000

# Para lanzar en ventana separada (PowerShell 7):
Start-Process pwsh -WorkingDirectory "F:\projects\developments\games-tracker-backend" -ArgumentList "-NoExit", "-Command", "npm start"
Start-Process pwsh -WorkingDirectory "F:\projects\developments\games-tracker" -ArgumentList "-NoExit", "-Command", "npm start"
```

El backend debe estar corriendo en `http://localhost:4000`.

### Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Dev server en puerto 3000 (HMR) |
| `npm run build` | Build producción a `dist/` |
| `npm run preview` | Preview local del build |
| `npm test` | Tests con Vitest |
| `npm run test:watch` | Tests en modo watch |

---

## 🔗 API Endpoints Consumidos

| Endpoint | Método | Componente | Propósito |
|----------|--------|-----------|-----------|
| `/games` | GET | App.js | Obtener todos los juegos |
| `/games` | POST | GameForm.js | Crear nuevo juego |
| `/games/:id` | PUT | GameList.js | Editar juego |
| `/games/:id` | DELETE | GameList.js | Eliminar juego |
| `/consoles` | GET | GameForm.js | Obtener lista de consolas |
| `/search` | POST | GameForm.js | Búsqueda mock local |

---

## 🧩 Componentes

### `src/config.js`
- Exporta `API_URL` desde `import.meta.env.VITE_API_URL` o default `http://localhost:4000`
- Todos los componentes importan desde aquí (un solo punto de cambio)

### App.jsx
- **Única fuente de datos** (`useCallback` + `useEffect`)
- Estados: `games`, `loading`, `error`
- Callbacks: `onGameAdded`, `onGameDeleted`, `onGameUpdated` → recarga la lista
- Pasa `games`, `loading`, `error` a GameList

### GameForm.js
- Búsqueda mock local con **debounce de 400ms**
- Conversión de imágenes IGDB a Base64 (con manejo de errores)
- Selector de año con `react-datepicker`
- **Feedback visual:** mensajes success/error en UI
- **Loading state** en botón submit
- Submit mapea campos: `consoleId` → `console_id`, `yearPlayed` → `year_played`

### GameList.js
- Recibe datos por props (no fetch propio)
- **Estados:** loading / error con reintento / empty ("No hay juegos")
- **Editar inline:** al hacer click en "Editar", el card se convierte en formulario
- **Eliminar:** con confirmación (`confirm()`)
- Botones con loading state individual (`saving` / `deleting` por ID)

---

## 🎨 Estados Visuales por Componente

| Componente | Loading | Error | Empty | Success |
|-----------|---------|-------|-------|---------|
| GameList | "Cargando juegos..." + spinner | Mensaje + botón Reintentar | "No hay juegos registrados aún" | Cards con datos |
| GameForm | Botón "Guardando..." deshabilitado | Feedback rojo en formulario | — | Feedback verde + formulario limpio |

---

## 📦 Dependencias

| Paquete | Versión | Uso |
|---------|---------|-----|
| react | ^19.2.7 | Core |
| react-dom | ^19.2.7 | DOM renderer |
| vite | ^7.3.5 | Build / dev server |
| @vitejs/plugin-react | ^4.7.0 | React JSX transform |
| vitest | ^3.2.6 | Test runner |
| jsdom | ^26.1.0 | DOM para tests |
| react-datepicker | ^9.1.0 | Selector año |
| date-fns | ^4.4.0 | Fechas (dep de datepicker) |
| @testing-library/react | ^16.3.2 | Render para tests |
| @testing-library/jest-dom | ^6.9.1 | Matchers DOM |
| @testing-library/user-event | ^14.6.1 | Simulación usuario |

---

## 🔧 Convenciones

- **API URL:** Centralizada en `src/config.js`
- **Campos backend:** snake_case (`console_id`, `year_played`, `console_name`)
- **Estados locales:** camelCase (`consoleId`, `yearPlayed`) y se mapean al enviar
- **Fetch nativo:** No se usa axios, solo `fetch()` del browser
- **CRUD completo:** GET (App), POST (GameForm), PUT/DELETE (GameList)

---

## 🧪 Tests

```bash
npm test                        # Vitest — verifica que "Games Tracker" y "Acceder" se renderizan
npm run test:watch              # Modo watch
```

---

## 🔗 Backend

El backend está en `F:\projects\developments\games-tracker-backend` con su propio `AGENTS.md`.
