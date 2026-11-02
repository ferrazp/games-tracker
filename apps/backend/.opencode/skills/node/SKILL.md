---
name: node
description: Provides domain-specific best practices for Node.js development with TypeScript, covering type stripping, async patterns, error handling, streams, modules, testing, performance, caching, logging, and more.
metadata:
  tags: node, nodejs, javascript, typescript, type-stripping, backend, server
---

## When to use

Use this skill whenever you are dealing with Node.js code to obtain domain-specific knowledge for building robust, performant, and maintainable Node.js applications.

## Key Practices for This Project

Since this project uses **Express.js with ESM** (not TypeScript, not Fastify), apply these adapted practices:

1. **Modular structure**: Split route handlers into separate files by resource (games, consoles, search, auth, stats)
2. **Error handling**: Use a shared error class + global error middleware (already in place at line 863)
3. **Graceful shutdown**: SIGINT handler exists (line 886) — keep it, add SIGTERM
4. **Environment config**: Keep `.env` usage via dotenv, validate required vars at startup
5. **Logging**: Already using pino — good, keep structured logging
6. **Async patterns**: All handlers are async — good, ensure `.catch()` doesn't swallow errors

## Common Workflows

**Graceful shutdown**: Register signal handlers (SIGTERM/SIGINT) → stop accepting new work → drain in-flight requests → close external connections (DB, cache) → exit with appropriate code.

**Error handling**: Define a shared error base class → classify errors (operational vs programmer) → add async boundary handlers (`process.on('unhandledRejection')`) → propagate typed errors through the call stack → log with context before responding or crashing.

## How to apply

- Split `server-unified.js` into: `src/routes/*.js`, `src/middleware/*.js`, `src/validators/*.js`, `src/services/*.js`
- Keep `server-unified.js` as the entry point that assembles everything
- Each route file exports an Express Router
- Each middleware file exports a single function
