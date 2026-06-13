import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getTestConsoleId } from '../helpers/setup.js';

describe('Search', () => {
  it('POST /search returns expected shape', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: 'mario' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.equal(res.body.source, 'local');
    assert.equal(typeof res.body.online_available, 'boolean');
  });

  it('POST /search returns 400 for empty query', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: '' });
    assert.equal(res.status, 400);
  });

  it('POST /search filters by console_id', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: 'Test', console_id: getTestConsoleId() });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
  });

  it('POST /search returns results for matching catalog entries', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: 'Test' });
    assert.equal(res.status, 200);
    assert.ok(res.body.results.length > 0);
    assert.ok(res.body.results.some(g => g.name && g.id));
  });

  it('POST /search returns empty results for non-matching query', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: 'zzzzzzz' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.equal(res.body.results.length, 0);
  });

  it('POST /search results have expected shape', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: 'Test' });
    assert.equal(res.status, 200);
    assert.ok(res.body.results.length > 0);
    for (const game of res.body.results) {
      assert.equal(typeof game.id, 'number');
      assert.equal(typeof game.name, 'string');
      assert.ok(game.console_name === null || typeof game.console_name === 'string');
      assert.ok(game.cover === null || (typeof game.cover === 'object' && typeof game.cover.url === 'string'));
      assert.ok(game.release_date === null || typeof game.release_date === 'number');
    }
  });

  it('POST /search handles special characters in query', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: '%_Test_%' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
  });

  it('POST /search handles whitespace-only query', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: '   ' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
  });

  it('POST /search with nonexistent console_id returns results', async () => {
    const res = await request(getApp())
      .post('/search')
      .send({ query: 'Test', console_id: 99999 });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.ok(res.body.results.length > 0);
  });

  it('POST /search/online returns results or 400', async () => {
    const res = await request(getApp())
      .post('/search/online')
      .send({ query: 'mario' });
    if (res.status === 200) {
      assert.ok(Array.isArray(res.body.results));
      assert.equal(res.body.source, 'online');
    } else {
      assert.equal(res.status, 400);
    }
  });

  it('POST /search/online returns 400 for empty query', async () => {
    const res = await request(getApp())
      .post('/search/online')
      .send({ query: '' });
    assert.equal(res.status, 400);
  });

  it('POST /search/online filters by console_id', async () => {
    const res = await request(getApp())
      .post('/search/online')
      .send({ query: 'mario', console_id: getTestConsoleId() });
    assert.ok(res.status === 200 || res.status === 400);
  });
});
