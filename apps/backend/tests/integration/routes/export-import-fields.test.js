import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth } from '../helpers/setup.js';

const FIELDS = {
  year_played: 2020,
  month_played: 3,
  year_completed: 2021,
  month_completed: 7,
  hours_played: 42.5,
  release_year: 2017,
};

async function firstConsole() {
  const res = await request(getApp()).get('/consoles');
  return res.body.consoles[0];
}

async function findGame(title) {
  const res = await request(getApp()).get('/games').query({ q: title });
  return res.body.games.find((g) => g.title === title);
}

describe('Export/Import con todos los campos', () => {
  it('GET /export incluye mes, completado, horas, año de lanzamiento y launch_year de consolas', async () => {
    const consola = await firstConsole();
    const title = `Export campos ${Date.now()}`;
    const created = await request(getApp()).post('/games').set('Authorization', getAuth())
      .send({ title, console_id: consola.id, completed: true, ...FIELDS });
    assert.equal(created.status, 201, JSON.stringify(created.body));

    const res = await request(getApp()).get('/export').set('Authorization', getAuth());
    assert.equal(res.status, 200);
    const g = res.body.games.find((x) => x.title === title);
    assert.ok(g, 'el juego está en el export');
    for (const [k, v] of Object.entries(FIELDS)) assert.equal(Number(g[k]), v, k);
    assert.ok('launch_year' in res.body.consoles[0], 'consolas con launch_year');
  });

  it('POST /import restaura los campos nuevos', async () => {
    const consola = await firstConsole();
    const title = `Import campos ${Date.now()}`;
    const res = await request(getApp()).post('/import').set('Authorization', getAuth())
      .send({ games: [{ title, console_name: consola.name, completed: true, ...FIELDS }] });
    assert.equal(res.status, 200);
    assert.equal(res.body.imported_games, 1);

    const g = await findGame(title);
    assert.ok(g, 'el juego importado existe');
    for (const [k, v] of Object.entries(FIELDS)) assert.equal(Number(g[k]), v, k);
    assert.equal(g.console_id, consola.id);
  });

  it('export e import incluyen la wishlist (por igdb_id y orden)', async () => {
    const added = await request(getApp()).post('/wishlist').set('Authorization', getAuth())
      .send({ igdb_id: 4242, title: 'Wishlist export test', console_name: 'PC' });
    assert.equal(added.status, 201);

    const exp = await request(getApp()).get('/export').set('Authorization', getAuth());
    const item = (exp.body.wishlist || []).find((w) => Number(w.igdb_id) === 4242);
    assert.ok(item, 'la wishlist está en el export');
    assert.equal(typeof item.sort_order, 'number');
    assert.equal(item.title, 'Wishlist export test');

    await request(getApp()).delete(`/wishlist/${added.body.game.id}`).set('Authorization', getAuth());
    const imp = await request(getApp()).post('/import').set('Authorization', getAuth())
      .send({ wishlist: [{ igdb_id: 4242, sort_order: 5 }] });
    assert.equal(imp.status, 200);
    assert.equal(imp.body.imported_wishlist, 1);

    const list = await request(getApp()).get('/wishlist').set('Authorization', getAuth());
    const back = list.body.games.find((w) => w.title === 'Wishlist export test');
    assert.ok(back, 'vuelve a estar en la wishlist');
    assert.equal(back.sort_order, 5);
  });
});
