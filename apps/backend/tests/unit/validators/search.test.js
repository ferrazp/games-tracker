import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSearchQuery } from '../../../src/validators/search.js';

describe('validateSearchQuery', () => {
  it('returns valid for normal query', () => {
    const r = validateSearchQuery('mario');
    assert.ok(r.valid);
  });

  it('rejects empty string', () => {
    assert.ok(!validateSearchQuery('').valid);
  });

  it('rejects non-string values', () => {
    assert.ok(!validateSearchQuery(null).valid);
    assert.ok(!validateSearchQuery(undefined).valid);
    assert.ok(!validateSearchQuery(123).valid);
    assert.ok(!validateSearchQuery({}).valid);
  });

  it('rejects query longer than 100 characters', () => {
    const longStr = 'a'.repeat(101);
    const r = validateSearchQuery(longStr);
    assert.ok(!r.valid);
    assert.ok(r.error.includes('100'));
  });

  it('accepts query with exactly 100 characters', () => {
    const r = validateSearchQuery('a'.repeat(100));
    assert.ok(r.valid);
  });

  it('accepts single character query', () => {
    const r = validateSearchQuery('x');
    assert.ok(r.valid);
  });

  it('accepts whitespace-only string', () => {
    const r = validateSearchQuery('   ');
    assert.ok(r.valid);
  });
});
