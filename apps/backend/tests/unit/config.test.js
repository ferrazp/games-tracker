import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config, CURRENT_YEAR, CURRENT_MONTH } from '../../src/config.js';

function getConfigUrl() {
  const url = new URL('../../src/config.js', import.meta.url);
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

describe('Config', () => {
  it('exports server port as number', () => {
    assert.equal(typeof config.server.port, 'number');
  });

  it('exports frontendUrl as string', () => {
    assert.equal(typeof config.server.frontendUrl, 'string');
  });

  it('exports auth config', () => {
    assert.equal(typeof config.auth.jwtSecret, 'string');
    assert.equal(typeof config.auth.adminUser, 'string');
    assert.equal(typeof config.auth.adminPass, 'string');
    assert.equal(typeof config.auth.apiKey, 'string');
  });

  it('exports twitch config', () => {
    assert.ok('clientId' in config.twitch);
    assert.ok('clientSecret' in config.twitch);
    assert.equal(typeof config.twitch.hasCredentials, 'boolean');
  });

  it('config is frozen (shallow)', () => {
    assert.throws(() => { config.server = { port: 9999 }; }, TypeError);
  });

  it('exports CURRENT_YEAR and CURRENT_MONTH', () => {
    assert.equal(typeof CURRENT_YEAR, 'number');
    assert.equal(typeof CURRENT_MONTH, 'number');
    assert.ok(CURRENT_YEAR >= 2024);
  });

  it('uses custom PORT value', withEnv('PORT', '5678', async () => {
    const mod = await import(getConfigUrl());
    assert.equal(mod.config.server.port, 5678);
  }));

  it('uses custom FRONTEND_URL value', withEnv('FRONTEND_URL', 'http://example.com', async () => {
    const mod = await import(getConfigUrl());
    assert.equal(mod.config.server.frontendUrl, 'http://example.com');
  }));

  it('detects API_KEY when set', withEnv('API_KEY', 'my-secret-key', async () => {
    const mod = await import(getConfigUrl());
    assert.equal(mod.config.auth.apiKey, 'my-secret-key');
  }));

  it('hasCredentials is true when twitch env vars are set', withEnv('TWITCH_CLIENT_ID', 'test-id', withEnv('TWITCH_CLIENT_SECRET', 'test-secret', async () => {
    const mod = await import(getConfigUrl());
    assert.equal(mod.config.twitch.hasCredentials, true);
  })));
});
