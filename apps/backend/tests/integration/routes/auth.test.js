import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp } from '../helpers/setup.js';

describe('Auth', () => {
  it('POST /auth/login succeeds with valid credentials', async () => {
    const res = await request(getApp())
      .post('/auth/login')
      .send({ username: 'admin', password: '1234' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, 'admin');
    assert.equal(res.body.user.role, 'admin');
  });

  it('POST /auth/login returns 401 with wrong password', async () => {
    const res = await request(getApp())
      .post('/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    assert.equal(res.status, 401);
  });

  it('POST /auth/login returns 400 with missing username', async () => {
    const res = await request(getApp())
      .post('/auth/login')
      .send({ password: '1234' });
    assert.equal(res.status, 400);
  });

  it('POST /auth/login returns 400 with missing password', async () => {
    const res = await request(getApp())
      .post('/auth/login')
      .send({ username: 'admin' });
    assert.equal(res.status, 400);
  });
});
