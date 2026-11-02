---
name: linting-neostandard-eslint9
description: Configures ESLint v9 flat config and neostandard for JavaScript projects.
metadata:
  tags: linting, neostandard, eslint, eslint9, flat-config, javascript
---

## When to use

Use this skill when you need to:
- Set up linting in a JavaScript project
- Use `neostandard` as a Standard-like ESLint v9 flat-config baseline
- Configure `eslint@9` with the flat config system (`eslint.config.js`/`eslint.config.mjs`)

## Quick start: basic neostandard setup

Install dependencies and create a minimal `eslint.config.js`:

```bash
npm install --save-dev eslint@9 neostandard
```

```js
// eslint.config.js
import neostandard from 'neostandard'

export default neostandard()
```

Verify the config works:

```bash
npx eslint .
```

## Common setup workflow (new project)

1. Install `eslint@9` and `neostandard`
2. Create `eslint.config.js` with `neostandard()` as the base
3. Add any project-specific rule overrides on top
4. Run `npx eslint .` to confirm no config errors
5. Add a lint script to `package.json`: `"lint": "eslint ."`
6. Integrate into CI with a non-fix run; use `--fix` only in local workflows
