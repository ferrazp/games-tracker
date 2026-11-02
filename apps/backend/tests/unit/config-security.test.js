import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuthConfig } from '../../src/config.js';

const STRONG = { JWT_SECRET: 'a'.repeat(32), ADMIN_USER: 'pablo', ADMIN_PASS: 'una-clave-larga' };

describe('validateAuthConfig', () => {
  it('no exige nada fuera de producción', () => {
    assert.deepEqual(validateAuthConfig({ NODE_ENV: 'development' }), []);
  });

  it('en producción rechaza JWT_SECRET ausente', () => {
    const errors = validateAuthConfig({ ...STRONG, NODE_ENV: 'production', JWT_SECRET: undefined });
    assert.ok(errors.some(e => e.includes('JWT_SECRET')));
  });

  it('en producción rechaza JWT_SECRET corto (< 32 caracteres)', () => {
    const errors = validateAuthConfig({ ...STRONG, NODE_ENV: 'production', JWT_SECRET: 'corto' });
    assert.ok(errors.some(e => e.includes('JWT_SECRET')));
  });

  it('en producción rechaza ADMIN_PASS ausente o igual al default', () => {
    assert.ok(validateAuthConfig({ ...STRONG, NODE_ENV: 'production', ADMIN_PASS: undefined }).some(e => e.includes('ADMIN_PASS')));
    assert.ok(validateAuthConfig({ ...STRONG, NODE_ENV: 'production', ADMIN_PASS: '1234' }).some(e => e.includes('ADMIN_PASS')));
  });

  it('en producción acepta configuración fuerte', () => {
    assert.deepEqual(validateAuthConfig({ ...STRONG, NODE_ENV: 'production' }), []);
  });
});
