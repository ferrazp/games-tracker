import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp } from '../helpers/setup.js';

describe('Endpoints protegidos con JWT', () => {
  it('GET /stats devuelve 401 sin JWT', async () => {
    const res = await request(getApp()).get('/stats');
    assert.equal(res.status, 401);
  });

  it('GET /export devuelve 401 sin JWT', async () => {
    const res = await request(getApp()).get('/export');
    assert.equal(res.status, 401);
  });

  it('POST /import devuelve 401 sin JWT', async () => {
    const res = await request(getApp()).post('/import').send({ consoles: [{ name: 'Intruso' }] });
    assert.equal(res.status, 401);
  });

  it('POST /search/online devuelve 401 sin JWT', async () => {
    const res = await request(getApp()).post('/search/online').send({ query: 'zelda' });
    assert.equal(res.status, 401);
  });
});
