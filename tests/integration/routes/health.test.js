import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp } from '../helpers/setup.js';

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(getApp()).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /version returns version info', async () => {
    const res = await request(getApp()).get('/version');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.version, 'string');
    assert.equal(typeof res.body.name, 'string');
  });
});
