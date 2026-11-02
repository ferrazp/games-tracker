---
name: environment
description: Environment configuration
---

# Environment Configuration

## Validation

Validate required env vars at startup:

```javascript
function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  dbType: process.env.DB_TYPE || 'sqlite',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
};
```

## Configuration Object

Create a single config object:

```javascript
export const config = Object.freeze({
  server: {
    port: parseInt(process.env.PORT || '4000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    adminUser: process.env.ADMIN_USER || 'admin',
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
  },
});
```
