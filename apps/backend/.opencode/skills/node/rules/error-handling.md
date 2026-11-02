---
name: error-handling
description: Error handling patterns in Node.js
---

# Error Handling in Node.js

## Custom Errors

Create error classes with codes:

```javascript
class AppError extends Error {
  constructor(message, { code, statusCode = 500, cause } = {}) {
    super(message, { cause });
    this.code = code;
    this.statusCode = statusCode;
  }
}

function notFound(resource) {
  return new AppError(`${resource} not found`, { code: 'NOT_FOUND', statusCode: 404 });
}

function validationError(message) {
  return new AppError(message, { code: 'VALIDATION_ERROR', statusCode: 400 });
}
```

## Async Error Handling

Always use try-catch with async/await:

```javascript
async function fetchUser(id) {
  try {
    const user = await db.users.findById(id);
    if (!user) throw notFound('User');
    return user;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Database error', { code: 'DATABASE_ERROR', cause: error });
  }
}
```

## Never Swallow Errors

```javascript
// BAD
try { await riskyOp(); } catch {}

// GOOD
try { await riskyOp(); } catch (error) {
  logger.error({ err: error }, 'Operation failed');
  throw error;
}
```
