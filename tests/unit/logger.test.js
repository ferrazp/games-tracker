import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function getLoggerUrl() {
  const url = new URL('../../db/logger.js', import.meta.url);
  url.searchParams.set('t', Date.now());
  return url.href;
}

function withEnv(envKey, envVal, fn) {
  return async () => {
    const orig = process.env[envKey];
    process.env[envKey] = envVal;
    try {
      await fn();
    } finally {
      if (orig === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = orig;
      }
    }
  };
}

describe('Logger', () => {
  it('exports a logger object with level property', async () => {
    const logger = (await import('../../db/logger.js')).default;
    assert.equal(typeof logger.level, 'string');
  });

  it('uses debug level in development/test by default', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const logger = (await import(getLoggerUrl())).default;
      assert.equal(logger.level, 'debug');
    } finally {
      process.env.NODE_ENV = origNodeEnv;
    }
  });

  it('uses info level in production', withEnv('NODE_ENV', 'production', async () => {
    const logger = (await import(getLoggerUrl())).default;
    assert.equal(logger.level, 'info');
  }));

  it('uses custom LOG_LEVEL when set', withEnv('LOG_LEVEL', 'error', async () => {
    const logger = (await import(getLoggerUrl())).default;
    assert.equal(logger.level, 'error');
  }));
});
