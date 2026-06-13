---
name: graceful-shutdown
description: Graceful shutdown and signal handling
---

# Graceful Shutdown

## Signal Handling

Handle SIGTERM and SIGINT to close resources cleanly:

```javascript
async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down...');
  await closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

## Health Check During Shutdown

Mark server as not-ready during shutdown for load balancers:

```javascript
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  isShuttingDown = true;
  await new Promise(r => setTimeout(r, 5000)); // drain window
  await closeDatabase();
  process.exit(0);
});
```
