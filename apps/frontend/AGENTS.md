# 🎮 AGENTS.md - Frontend Games Tracker

## 📋 Visión General

Frontend del gestor personal de videojuegos. Consume la API del backend en `http://localhost:4000`.

- **Framework:** React 18 + Create React App
- **Puerto:** 3000
- **Backend:** `F:\projects\developments\games-tracker-backend` (ver AGENTS.md allí)
- **API URL:** Centralizada en `src/config.js` (variable `REACT_APP_API_URL` o default `http://localhost:4000`)

---

## 📂 Estructura

```
games-tracker/
├── public/
│   └── index.html               # Título: "Games Tracker"
├── src/
│   ├── config.js                 # API_URL centralizada
│   ├── App.js                    # Componente raíz, única fuente de datos
│   ├── App.css                   # Estilos principales (cards, botones, feedback)
│   ├── index.js                  # Entry point
│   ├── index.css                 # Estilos globales
│   ├── components/
│   │   ├── GameForm.js           # Formulario: crear juego + búsqueda mock local
│   │   └── GameList.js           # Lista con editar/eliminar + estados
│   ├── App.test.js               # Test: renderiza "Registro de Juegos"
│   └── reportWebVitals.js
├── package.json
├── FIXES.md
└── AGENTS.md
```

---

## 🚀 Quick Start

```bash
cd F:\projects\developments\games-tracker
npm start                       # Inicia en http://localhost:3000
```

El backend debe estar corriendo en `http://localhost:4000`.

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
- Exporta `API_URL` desde `REACT_APP_API_URL` o default `http://localhost:4000`
- Todos los componentes importan desde aquí (un solo punto de cambio)

### App.js
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
| react | ^18.3.1 | Core |
| react-dom | ^18.3.1 | DOM renderer |
| react-scripts | 5.0.1 | Build / CRA |
| react-datepicker | ^7.3.0 | Selector año |
| date-fns | ^4.1.0 | Fechas (dep de datepicker) |
| web-vitals | ^2.1.4 | Métricas |

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
npm test                        # Verifica que "Registro de Juegos" se renderiza
```

---

## 🔗 Backend

El backend está en `F:\projects\developments\games-tracker-backend` con su propio `AGENTS.md`.
