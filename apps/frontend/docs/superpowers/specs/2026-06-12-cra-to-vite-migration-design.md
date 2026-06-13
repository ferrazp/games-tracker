# CRA to Vite + Vitest Migration Design

## Goal

Migrate the frontend (`games-tracker`) from Create React App (react-scripts 5.0.1) to Vite, including migrating the test infrastructure from Jest (via react-scripts) to Vitest.

This eliminates two build warnings:
- `DEP0176: fs.F_OK is deprecated` (from react-dev-utils / CRA dependency chain)
- `Critical dependency: the request of a dependency is an expression` (webpack warning from CRA)

## Scope

Single PR against the frontend repo. Backend is unaffected.

## Changes

### Dependencies

**Add:**
- `vite` + `@vitejs/plugin-react` — build and dev server
- `vitest` + `jsdom` — test runner
- `@testing-library/jest-dom` — Vitest-compatible matchers (already installed, just needs vitest import)

**Remove:**
- `react-scripts` (and its implicit Jest/webpack/Babel config)
- `web-vitals` (CRA template legacy — not used in any component)
- `reportWebVitals.js` file

**Keep:**
- `@testing-library/react` — works with Vitest via jsdom
- `@testing-library/user-event` — works with Vitest
- `date-fns`, `react-datepicker` — unaffected
- `react`, `react-dom` — unaffected

### New files

#### `vite.config.js` (project root)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
```

#### `index.html` (project root — moved from `public/`)

Vite requires `index.html` at the root with an explicit `<script type="module">` tag pointing to the entry point:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Gestor personal de videojuegos jugados" />
    <link rel="apple-touch-icon" href="/logo192.png" />
    <link rel="manifest" href="/manifest.json" />
    <title>Games Tracker</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/src/index.js"></script>
  </body>
</html>
```

### Modified files

#### `package.json`

```json
{
  "name": "games-tracker",
  "version": "1.2.0-dev.1",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "vite --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "date-fns": "^4.4.0",
    "react": "^19.2.7",
    "react-datepicker": "^9.1.0",
    "react-dom": "^19.2.7",
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vitest": "^3.0.0",
    "jsdom": "^26.0.0"
  },
  "devDependencies": {}
}
```

Removed: `react-scripts`, `web-vitals`, `eslintConfig`, `browserslist`.

#### `src/index.js`

Simplify — `reportWebVitals` call removed. The `createRoot` + `StrictMode` remains.

#### `src/config.js`

Replace `process.env.REACT_APP_API_URL` with `import.meta.env.VITE_API_URL`.

The `require('../package.json')` for version needs to change to `import pkg from '../package.json'` (ESM).

```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
import pkg from '../package.json';
const FRONTEND_VERSION = pkg.version;
```

#### `src/App.test.js`

Add import for Vitest-compatible matchers:

```js
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen', () => {
  render(<App />);
  const title = screen.getByText(/Games Tracker/i);
  expect(title).toBeInTheDocument();
  const loginBtn = screen.getByText(/Acceder/i);
  expect(loginBtn).toBeInTheDocument();
});
```

#### `src/setupTests.js`

Deleted — CRA-specific. No setup needed for Vitest (no `@testing-library/jest-dom` auto-import).

#### `public/index.html`

Deleted — replaced by root `index.html`.

#### `Dockerfile`

Builder stage updated:

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY public ./public
COPY src ./src
COPY vite.config.js index.html ./
ARG VITE_API_URL=http://backend:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS runner
...
```

Note: `ARG REACT_APP_VERSION` removed — Vite gets version from `package.json` via import at build time.

#### `nginx.conf`

No changes needed. Vite build outputs to `dist/` which is copied from `/app/build` → `/usr/share/nginx/html` in the Dockerfile. The COPY path changes from `builder /app/build` to `builder /app/dist`.

### Removed files

- `public/index.html`
- `src/reportWebVitals.js`
- `src/setupTests.js`

## Test Infrastructure

- Vitest runs in Node with `jsdom` environment
- Tests use `globals: true` so `describe`, `it`, `expect` are available without imports
- `@testing-library/jest-dom/vitest` adds `.toBeInTheDocument()` etc. as Vitest matchers
- No Jest configuration needed (CRA's implicit Jest config is gone)

## Docker / Deployment

- Build output changes from `build/` to `dist/`
- Dockerfile: `COPY --from=builder /app/build /usr/share/nginx/html` → `COPY --from=builder /app/dist /usr/share/nginx/html`
- nginx.conf: no changes
- `docker-compose.yml` / `docker-compose.dev.yml`: no changes (the `REACT_APP_API_URL` env var in compose files must be renamed to `VITE_API_URL`)

## Env vars migration

| CRA | Vite |
|---|---|
| `REACT_APP_API_URL` | `VITE_API_URL` |
| `process.env.REACT_APP_API_URL` | `import.meta.env.VITE_API_URL` |

The docker-compose files (production and dev) need `REACT_APP_API_URL` → `VITE_API_URL`.

## Verification

1. `npm run build` succeeds (production build)
2. `npm test` passes (existing test)
3. `npm start` starts on port 3000
4. Docker build succeeds with updated Dockerfile
5. No deprecation warnings in build output
6. App works end-to-end against backend

## Non-goals

- No component refactoring
- No CSS changes
- No new tests — only ensure existing test passes
- No changes to the backend
