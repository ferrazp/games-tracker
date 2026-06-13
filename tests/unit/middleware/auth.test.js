import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth, requireJWT } from '../../../src/middleware/auth.js';
import { config } from '../../../src/config.js';

describe('requireAuth middleware', () => {
  it('calls next when no API key configured', () => {
    config.auth.apiKey = '';
    let called = false;
    requireAuth({ headers: {} }, {}, () => { called = true; });
    assert.ok(called);
  });

  it('calls next when API key matches', () => {
    config.auth.apiKey = 'secret123';
    let called = false;
    const req = { headers: { 'x-api-key': 'secret123' } };
    requireAuth(req, { status: () => ({ json: () => {} }) }, () => { called = true; });
    assert.ok(called);
  });

  it('returns 401 when API key is missing', () => {
    config.auth.apiKey = 'secret123';
    let statusCode;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };
    requireAuth({ headers: {} }, res, () => {});
    assert.equal(statusCode, 401);
  });

  it('returns 401 when API key is wrong', () => {
    config.auth.apiKey = 'secret123';
    let statusCode;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };
    requireAuth({ headers: { 'x-api-key': 'wrong' } }, res, () => {});
    assert.equal(statusCode, 401);
  });
});

describe('requireJWT middleware', () => {
  let validToken;

  before(async () => {
    const jwt = await import('jsonwebtoken');
    validToken = jwt.default.sign(
      { username: 'admin', role: 'admin' },
      config.auth.jwtSecret,
      { expiresIn: '24h' }
    );
  });

  it('calls next with valid token', () => {
    let called = false;
    let user;
    const req = { headers: { authorization: `Bearer ${validToken}` } };
    requireJWT(req, {}, () => { called = true; user = req.user; });
    assert.ok(called);
    assert.equal(user.username, 'admin');
  });

  it('returns 401 when no auth header', () => {
    let statusCode;
    const res = { status: (code) => { statusCode = code; return { json: () => {} }; } };
    requireJWT({ headers: {} }, res, () => {});
    assert.equal(statusCode, 401);
  });

  it('returns 401 when header is not Bearer', () => {
    let statusCode;
    const res = { status: (code) => { statusCode = code; return { json: () => {} }; } };
    requireJWT({ headers: { authorization: 'Basic abc' } }, res, () => {});
    assert.equal(statusCode, 401);
  });

  it('returns 401 with invalid token', () => {
    let statusCode;
    const res = { status: (code) => { statusCode = code; return { json: () => {} }; } };
    requireJWT({ headers: { authorization: 'Bearer invalid.token.here' } }, res, () => {});
    assert.equal(statusCode, 401);
  });

  it('returns 401 with expired token', async () => {
    const jwt = await import('jsonwebtoken');
    const expiredToken = jwt.default.sign(
      { username: 'admin' },
      config.auth.jwtSecret,
      { expiresIn: '0s' }
    );
    await new Promise(r => setTimeout(r, 100));
    let statusCode;
    const res = { status: (code) => { statusCode = code; return { json: () => {} }; } };
    requireJWT({ headers: { authorization: `Bearer ${expiredToken}` } }, res, () => {});
    assert.equal(statusCode, 401);
  });
});
