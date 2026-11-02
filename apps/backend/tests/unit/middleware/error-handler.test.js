import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler, notFound } from '../../../src/middleware/error-handler.js';

describe('errorHandler middleware', () => {
  it('returns 500 with error message', () => {
    let statusCode, body;
    const res = {
      status: (code) => { statusCode = code; return { json: (b) => { body = b; } }; }
    };
    errorHandler(new Error('test error'), {}, res, () => {});
    assert.equal(statusCode, 500);
    assert.equal(body.error, 'Internal server error');
  });
});

describe('notFound middleware', () => {
  it('returns 404 with error message', () => {
    let statusCode, body;
    const res = {
      status: (code) => { statusCode = code; return { json: (b) => { body = b; } }; }
    };
    notFound({}, res);
    assert.equal(statusCode, 404);
    assert.equal(body.error, 'Endpoint not found');
  });
});
