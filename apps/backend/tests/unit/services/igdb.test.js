import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IGDB_PLATFORM_TO_CONSOLE } from '../../../src/services/igdb.js';

describe('IGDB Platform Map', () => {
  it('maps known platforms', () => {
    assert.equal(IGDB_PLATFORM_TO_CONSOLE[18], 'Family Game');
    assert.equal(IGDB_PLATFORM_TO_CONSOLE[19], 'Super Nintendo');
    assert.equal(IGDB_PLATFORM_TO_CONSOLE[4], 'Nintendo 64');
    assert.equal(IGDB_PLATFORM_TO_CONSOLE[48], 'PlayStation 4');
    assert.equal(IGDB_PLATFORM_TO_CONSOLE[167], 'PlayStation 5');
    assert.equal(IGDB_PLATFORM_TO_CONSOLE[130], 'Nintendo Switch');
    assert.equal(IGDB_PLATFORM_TO_CONSOLE[6], 'PC');
  });

  it('has expected platform count', () => {
    assert.equal(Object.keys(IGDB_PLATFORM_TO_CONSOLE).length, 15);
  });
});
