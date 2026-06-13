# CRA to Vite + Vitest Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the frontend from Create React App (react-scripts 5.0.1) to Vite + Vitest, eliminating build deprecation warnings and modernizing the toolchain.

**Architecture:** Replace react-scripts with Vite for dev/build, replace Jest (via react-scripts) with Vitest for tests, move index.html to project root, update env var prefix from REACT_APP_ to VITE_, update Dockerfile for Vite output.

**Tech Stack:** Vite 7, @vitejs/plugin-react 4, Vitest 3, jsdom 26, React 19, Nginx (unchanged)

---

### Task 1: Update package.json

**Files:**
- Modify: `F:\projects\developments\games-tracker\package.json` (full file)

- [ ] **Step 1: Read current package.json**

Read: `F:\projects\developments\games-tracker\package.json`

- [ ] **Step 2: Replace with updated content**

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
    "@vitejs/plugin-react": "^4.4.0",
    "date-fns": "^4.4.0",
    "jsdom": "^26.0.0",
    "react": "^19.2.7",
    "react-datepicker": "^9.1.0",
    "react-dom": "^19.2.7",
    "vite": "^7.0.0",
    "vitest": "^3.1.0"
  }
}
```

Changes from current:
- Added `"type": "module"` — Vite requires ESM mode
- Removed `react-scripts`, `web-vitals`
- Added `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`
- Removed `eslintConfig` and `browserslist` blocks
- Updated scripts: `start` → `vite --port 3000`, `build` → `vite build`, `test` → `vitest run`, added `preview` + `test:watch`

- [ ] **Step 3: Run npm install**

Run: `cd F:\projects\developments\games-tracker && npm install`

Expected: Installs all new deps, removes old ones.

---

### Task 2: Create vite.config.js

**Files:**
- Create: `F:\projects\developments\games-tracker\vite.config.js`

- [ ] **Step 1: Write vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

The `test` block configures Vitest:
- `environment: 'jsdom'` — DOM API in Node (replaces Jest + CRA setup)
- `globals: true` — `describe`, `it`, `expect` available without imports

---

### Task 3: Move index.html from public/ to root

**Files:**
- Create: `F:\projects\developments\games-tracker\index.html`
- Delete: `F:\projects\developments\games-tracker\public\index.html`

- [ ] **Step 1: Write root index.html**

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

Key difference from CRA version:
- Added `<script type="module" src="/src/index.js">` — Vite requires explicit entry point
- Removed CRA comments
- `%PUBLIC_URL%` → direct paths (Vite serves public/ at root)

- [ ] **Step 2: Delete public/index.html**

Run: `Remove-Item -LiteralPath "F:\projects\developments\games-tracker\public\index.html"`

---

### Task 4: Update src/config.js — env vars

**Files:**
- Modify: `F:\projects\developments\games-tracker\src\config.js`

- [ ] **Step 1: Replace env var access + import**

Old:
```js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const { version } = require('../package.json');
const FRONTEND_VERSION = version;
```

New:
```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
import pkg from '../package.json';
const FRONTEND_VERSION = pkg.version;
```

Changes:
- `process.env.REACT_APP_API_URL` → `import.meta.env.VITE_API_URL`
- `require('../package.json')` → ESM `import` (works because Vite supports JSON imports, and `"type": "module"` is set in package.json)

---

### Task 5: Update src/index.js — remove reportWebVitals

**Files:**
- Modify: `F:\projects\developments\games-tracker\src\index.js`

- [ ] **Step 1: Remove reportWebVitals import and call**

```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Removed:
- `import reportWebVitals from './reportWebVitals';`
- `reportWebVitals();` call

---

### Task 6: Update src/App.test.js — add vitest-dom import

**Files:**
- Modify: `F:\projects\developments\games-tracker\src\App.test.js`

- [ ] **Step 1: Add vitest-dom matchers import**

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

Added: `import '@testing-library/jest-dom/vitest';` — registers `.toBeInTheDocument()` etc as Vitest matchers.

---

### Task 7: Delete CRA-only files

**Files:**
- Delete: `F:\projects\developments\games-tracker\src\reportWebVitals.js`
- Delete: `F:\projects\developments\games-tracker\src\setupTests.js`

- [ ] **Step 1: Delete reportWebVitals.js**

`Remove-Item -LiteralPath "F:\projects\developments\games-tracker\src\reportWebVitals.js"`

- [ ] **Step 2: Delete setupTests.js**

`Remove-Item -LiteralPath "F:\projects\developments\games-tracker\src\setupTests.js"`

---

### Task 8: Update Dockerfile

**Files:**
- Modify: `F:\projects\developments\games-tracker\Dockerfile`

- [ ] **Step 1: Update builder stage**

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

RUN adduser -D -g '' -h /app appuser

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R appuser:appuser /usr/share/nginx/html /var/cache/nginx /var/run && \
    chmod -R 755 /usr/share/nginx/html && \
    touch /var/run/nginx.pid && \
    chown appuser:appuser /var/run/nginx.pid

USER appuser

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1
```

Changes from current:
- Added `COPY vite.config.js index.html ./` — these are build-time files
- `ARG REACT_APP_API_URL` → `ARG VITE_API_URL`
- `ARG REACT_APP_VERSION` removed — Vite gets version from package.json
- `COPY --from=builder /app/build` → `/app/dist` — Vite output directory
- Removed `ENV REACT_APP_VERSION=$REACT_APP_VERSION` — no longer needed

---

### Task 9: Update docker-compose env vars (backend repo)

**Files:**
- Modify: `F:\projects\developments\games-tracker-backend\docker-compose.yml`
- Modify: `F:\projects\developments\games-tracker-backend\docker-compose.dev.yml`

- [ ] **Step 1: Update docker-compose.yml**

Change the frontend service env vars:
```yaml
frontend:
  build:
    context: ../games-tracker
  environment:
    - VITE_API_URL=http://backend:4000
```

- `REACT_APP_API_URL` → `VITE_API_URL`

- [ ] **Step 2: Update docker-compose.dev.yml**

Same change:
- `REACT_APP_API_URL` → `VITE_API_URL`

---

### Task 10: Verify build and tests

- [ ] **Step 1: Run npm run build**

Run: `cd F:\projects\developments\games-tracker && npm run build 2>&1`

Expected: Build succeeds. Output goes to `dist/`. No deprecation warnings.

- [ ] **Step 2: Run npm test**

Run: `cd F:\projects\developments\games-tracker && npm test 2>&1`

Expected: Tests pass with "1 passed".

- [ ] **Step 3: Verify no CRA files remain**

Run: `Test-Path "F:\projects\developments\games-tracker\src\reportWebVitals.js"` — False
`Test-Path "F:\projects\developments\games-tracker\src\setupTests.js"` — False
`Test-Path "F:\projects\developments\games-tracker\public\index.html"` — False
`Test-Path "F:\projects\developments\games-tracker\index.html"` — True

---

### Task 11: Update AGENTS.md

**Files:**
- Modify: `F:\projects\developments\games-tracker\AGENTS.md`

- [ ] **Step 1: Update framework reference**

Change: `"Framework: React 18 + Create React App"` → `"Framework: React 19 + Vite"`

- [ ] **Step 2: Update project structure**

Replace CRA structure with Vite structure (add vite.config.js, remove reportWebVitals.js + setupTests.js)

- [ ] **Step 3: Update scripts section**

Replace CRA scripts with Vite scripts:
- `npm start` → starts Vite dev server on port 3000
- `npm run build` → Vite production build to dist/
- `npm test` → Vitest

- [ ] **Step 4: Update dependencies table**

Remove react-scripts, web-vitals. Add vite, @vitejs/plugin-react, vitest, jsdom.

---

### Task 12: Final verification

- [ ] **Step 1: Run full build**

`cd F:\projects\developments\games-tracker && npm run build`

- [ ] **Step 2: Run tests**

`cd F:\projects\developments\games-tracker && npm test`

- [ ] **Step 3: Verify docker build works**

`docker build -t games-tracker-test -f F:\projects\developments\games-tracker\Dockerfile F:\projects\developments\games-tracker`

Expected: Docker build succeeds with no errors.
