import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIgdbClient } from '../../../src/services/igdb-client.js';

function setup(opts = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, at: Date.now() });
    return { ok: true, status: 200, json: async () => [] };
  };
  const client = createIgdbClient({
    fetchImpl,
    getToken: async () => 'tok',
    clientId: 'cid',
    minIntervalMs: 0,
    ...opts,
  });
  return { calls, client };
}

describe('igdb-client', () => {
  it('query manda POST con headers y body tal cual', async () => {
    const { calls, client } = setup();
    await client.query('games', 'fields name;');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.igdb.com/v4/games');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers['Client-ID'], 'cid');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
    assert.equal(calls[0].init.body, 'fields name;');
  });

  it('gamesByIds parte en lotes de 500', async () => {
    const { calls, client } = setup();
    const ids = Array.from({ length: 1001 }, (_, i) => i + 1);
    await client.gamesByIds(ids);
    assert.equal(calls.length, 3);
    assert.match(calls[0].init.body, /limit 500;/);
    assert.match(calls[2].init.body, /where id = \(1001\)/);
  });

  it('gamesByIds vacio no hace requests', async () => {
    const { calls, client } = setup();
    assert.deepEqual(await client.gamesByIds([]), []);
    assert.equal(calls.length, 0);
  });

  it('espacia requests consecutivas, tambien en paralelo', async () => {
    const { calls, client } = setup({ minIntervalMs: 50 });
    await Promise.all([client.query('games', 'a'), client.query('games', 'b')]);
    assert.ok(calls[1].at - calls[0].at >= 49);
  });

  it('respuesta no OK lanza error', async () => {
    const client = createIgdbClient({
      fetchImpl: async () => ({ ok: false, status: 429 }),
      getToken: async () => 'tok',
      clientId: 'cid',
      minIntervalMs: 0,
    });
    await assert.rejects(() => client.query('games', 'x'), { message: 'IGDB API error: 429' });
  });

  it('collectionMembers arma la consulta', async () => {
    const { calls, client } = setup();
    await client.collectionMembers(7);
    assert.match(calls[0].init.body, /^fields name,game_type,.*; where collections = \(7\); limit 500;$/);
  });

  it('search elimina comillas y omite where sin plataformas', async () => {
    const { calls, client } = setup();
    await client.search('Tales "of"', []);
    assert.match(calls[0].init.body, /^search "Tales of"; fields /);
    assert.ok(!calls[0].init.body.includes('where'));
    assert.match(calls[0].init.body, /limit 10;$/);
    await client.search('Back\\slash "x\\"', []);
    assert.match(calls[1].init.body, /^search "Back\\\\slash x\\\\"; fields /);
    await client.search('Zelda', [130, 6]);
    assert.match(calls[2].init.body, /where platforms = \(130,6\); limit 10;$/);
  });
});
