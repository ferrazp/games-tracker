import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getApp } from '../helpers/setup.js';

// En QA/Prod el backend recibe todo a través del nginx del front (red Docker privada).
describe('trust proxy', () => {
  const trusts = (ip) => getApp().get('trust proxy fn')(ip, 0);

  it('confía en el nginx de la red Docker (IP privada) y en loopback', () => {
    assert.equal(trusts('172.18.0.3'), true);
    assert.equal(trusts('10.0.0.5'), true);
    assert.equal(trusts('127.0.0.1'), true);
  });

  it('no confía en IPs públicas (no se puede falsear X-Forwarded-For desde afuera)', () => {
    assert.equal(trusts('8.8.8.8'), false);
  });
});
