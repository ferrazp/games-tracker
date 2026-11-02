import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth } from '../helpers/setup.js';

describe('Wishlist', () => {
  it('agrega por igdb_id y reordena en una transacción', async () => {
    const a = await request(getApp()).post('/wishlist').set('Authorization', getAuth()).send({ igdb_id: 999 });
    const b = await request(getApp()).post('/wishlist').set('Authorization', getAuth()).send({ igdb_id: 1000 });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);

    const res = await request(getApp())
      .put('/wishlist/reorder')
      .set('Authorization', getAuth())
      .send({ items: [{ id: a.body.game.id, sort_order: 2 }, { id: b.body.game.id, sort_order: 1 }] });
    assert.equal(res.status, 200);
    const ids = res.body.games.map(g => g.id);
    assert.ok(ids.indexOf(b.body.game.id) < ids.indexOf(a.body.game.id));
  });

  it('GET /wishlist devuelve 401 sin JWT', async () => {
    const res = await request(getApp()).get('/wishlist');
    assert.equal(res.status, 401);
  });
});
