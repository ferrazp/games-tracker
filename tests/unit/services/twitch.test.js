import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('Twitch Service', () => {
  it('module exports getTwitchToken function', async () => {
    const twitch = await import('../../../src/services/twitch.js');
    assert.equal(typeof twitch.getTwitchToken, 'function');
  });

  it('throws when token fetch fails', async (ctx) => {
    ctx.mock.method(globalThis, 'fetch', async () => ({
      ok: false, status: 401
    }));
    const twitch = await import('../../../src/services/twitch.js');
    await assert.rejects(
      () => twitch.getTwitchToken(),
      { message: 'Twitch auth failed: 401' }
    );
  });

  it('throws when response has no access_token', async (ctx) => {
    ctx.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => ({})
    }));
    const twitch = await import('../../../src/services/twitch.js');
    await assert.rejects(
      () => twitch.getTwitchToken(),
      { message: 'No access token in Twitch response' }
    );
  });
});
