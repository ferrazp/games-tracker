---
name: modules
description: ES Modules patterns
---

# Node.js Modules

## ES Modules

Use `import`/`export` with ESM:

```json
{ "type": "module" }
```

Always include file extensions in imports:

```javascript
import { helper } from './helper.js';
import config from './config.json' with { type: 'json' };
```

## Barrel Exports

Use index files to simplify imports:

```javascript
// routes/index.js
export { gamesRouter } from './games.js';
export { consolesRouter } from './consoles.js';
export { searchRouter } from './search.js';
```

## Named vs Default Exports

Prefer named exports:

```javascript
// GOOD
export function createServer() {}
export const CONFIG = {};

// AVOID
export default function createServer() {}
```
