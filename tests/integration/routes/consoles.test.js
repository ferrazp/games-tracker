import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth } from '../helpers/setup.js';

describe('Consoles', () => {
  it('GET /consoles returns list', async () => {
    const res = await request(getApp()).get('/consoles');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.consoles));
  });

  it('POST /consoles creates a console (201)', async () => {
    const res = await request(getApp())
      .post('/consoles')
      .set('Authorization', getAuth())
      .send({ name: 'New Console' });
    assert.equal(res.status, 201);
    assert.equal(res.body.console.name, 'New Console');
    assert.ok(res.body.console.id);
  });

  it('POST /consoles returns 400 on duplicate', async () => {
    const res = await request(getApp())
      .post('/consoles')
      .set('Authorization', getAuth())
      .send({ name: 'Test Console' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /consoles returns 401 without auth', async () => {
    const res = await request(getApp())
      .post('/consoles')
      .send({ name: 'Unauthorized Console' });
    assert.equal(res.status, 401);
  });

  it('POST /consoles returns 400 with empty name', async () => {
    const res = await request(getApp())
      .post('/consoles')
      .set('Authorization', getAuth())
      .send({ name: '' });
    assert.equal(res.status, 400);
  });

  it('POST /consoles returns 400 with missing name', async () => {
    const res = await request(getApp())
      .post('/consoles')
      .set('Authorization', getAuth())
      .send({});
    assert.equal(res.status, 400);
  });
});
