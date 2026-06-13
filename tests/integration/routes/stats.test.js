import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp } from '../helpers/setup.js';

describe('Stats', () => {
  it('GET /stats returns stats object', async () => {
    const res = await request(getApp()).get('/stats');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.total_games, 'number');
    assert.equal(typeof res.body.total_consoles, 'number');
    assert.equal(typeof res.body.completed_games, 'number');
    assert.ok(Array.isArray(res.body.games_by_console));
    assert.ok(Array.isArray(res.body.games_by_year));
    assert.equal(typeof res.body.catalog_size, 'number');
  });
});

describe('Export/Import', () => {
  let exportData;

  it('GET /export returns export data', async () => {
    const res = await request(getApp()).get('/export');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.exported_at, 'string');
    assert.equal(typeof res.body.db_type, 'string');
    assert.ok(Array.isArray(res.body.games));
    assert.ok(Array.isArray(res.body.consoles));
    assert.ok(Array.isArray(res.body.catalog));
    exportData = res.body;
  });

  it('POST /import imports consoles and games', async () => {
    const res = await request(getApp())
      .post('/import')
      .send({
        consoles: [{ name: 'Imported Console' }],
        games: [{ title: 'Imported Game', console_name: 'Imported Console', year_played: 2023 }]
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.imported_consoles, 1);
    assert.equal(res.body.imported_games, 1);
  });

  it('POST /import returns 400 with empty body', async () => {
    const res = await request(getApp())
      .post('/import')
      .send({});
    assert.equal(res.status, 400);
  });

  it('POST /import skips games with no title', async () => {
    const res = await request(getApp())
      .post('/import')
      .send({
        consoles: [],
        games: [{ console_name: 'Test Console', year_played: 2023 }]
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.imported_games, 0);
  });

  it('POST /import handles console with whitespace-only name', async () => {
    const res = await request(getApp())
      .post('/import')
      .send({
        consoles: [{ name: '   ' }],
        games: []
      });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.imported_consoles, 'number');
  });

  it('POST /import handles large games payload', async () => {
    const games = Array.from({ length: 50 }, (_, i) => ({
      title: `Bulk Game ${i}`,
      console_name: 'Test Console',
      year_played: 2020 + (i % 5)
    }));
    const res = await request(getApp())
      .post('/import')
      .send({ consoles: [], games });
    assert.equal(res.status, 200);
    assert.equal(res.body.imported_games, 50);
  });
});

describe('404 Handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(getApp()).get('/nonexistent');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Endpoint not found');
  });
});
