import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getDatabase } from '../../../db/database.js';
import { config } from '../../../src/config.js';
import { getApp, getAuth } from '../helpers/setup.js';

async function withBrokenDb(fn) {
  const db = getDatabase();
  const originalQuery = db.query.bind(db);
  db.query = async () => { throw new Error('DB error'); };
  try {
    await fn();
  } finally {
    db.query = originalQuery;
  }
}

describe('Error Handling', () => {
  it('GET /consoles returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp()).get('/consoles');
      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Error fetching consoles');
    });
  });

  it('POST /consoles returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp())
        .post('/consoles')
        .set('Authorization', getAuth())
        .send({ name: 'Test' });
      assert.equal(res.status, 500);
    });
  });

  it('POST /consoles inner catch handles duplicate', async () => {
    const res = await request(getApp())
      .post('/consoles')
      .set('Authorization', getAuth())
      .send({ name: 'Test Console' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Console already exists');
  });

  it('GET /games returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp()).get('/games');
      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Error fetching games');
    });
  });

  it('GET /games/:id returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp()).get('/games/1');
      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Error fetching game');
    });
  });

  it('POST /games returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp())
        .post('/games')
        .set('Authorization', getAuth())
        .send({ title: 'Test', console_id: 99, year_played: 2020 });
      assert.equal(res.status, 500);
    });
  });

  it('PUT /games/:id returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp())
        .put('/games/1')
        .set('Authorization', getAuth())
        .send({ title: 'Updated' });
      assert.equal(res.status, 500);
    });
  });

  it('DELETE /games/:id returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp())
        .delete('/games/1')
        .set('Authorization', getAuth());
      assert.equal(res.status, 500);
    });
  });

  it('GET /stats returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp()).get('/stats').set('Authorization', getAuth());
      assert.equal(res.status, 500);
      assert.equal(res.body.error, 'Error fetching stats');
    });
  });

  it('GET /export returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp()).get('/export').set('Authorization', getAuth());
      assert.equal(res.status, 500);
    });
  });

  it('POST /search returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp())
        .post('/search')
        .send({ query: 'test' });
      assert.equal(res.status, 500);
    });
  });

  it('POST /search/online returns 400 when no credentials', async () => {
    const orig = config.twitch.hasCredentials;
    config.twitch.hasCredentials = false;
    try {
      const res = await request(getApp())
        .post('/search/online')
        .send({ query: 'test' });
      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('Twitch credentials'));
    } finally {
      config.twitch.hasCredentials = orig;
    }
  });

  it('POST /search/online returns 500 when database throws', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp())
        .post('/search/online')
        .send({ query: 'test', console_id: 1 });
      assert.equal(res.status, 500);
    });
  });

  it('POST /import returns 500 when outer catch triggered', async () => {
    await withBrokenDb(async () => {
      const res = await request(getApp())
        .post('/import')
        .set('Authorization', getAuth())
        .send({ consoles: [{ name: 'Test' }], games: [] });
      assert.equal(res.status, 500);
    });
  });


});
