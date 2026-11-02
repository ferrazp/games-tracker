import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth } from '../helpers/setup.js';

async function firstConsole() {
  const res = await request(getApp()).get('/consoles');
  return res.body.consoles[0];
}

async function findGame(title) {
  const res = await request(getApp()).get('/games').query({ q: title });
  return res.body.games.find((g) => g.title === title);
}

describe('igdb_id en los juegos', () => {
  it('POST /games con igdb_id lo guarda con igdb_match = selected', async () => {
    const consola = await firstConsole();
    const title = `IGDB selected ${Date.now()}`;
    const res = await request(getApp()).post('/games').set('Authorization', getAuth())
      .send({ title, console_id: consola.id, igdb_id: 427 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.game.igdb_id, 427);
    assert.equal(res.body.game.igdb_match, 'selected');
    const g = await findGame(title);
    assert.equal(g.igdb_id, 427);
    assert.equal(g.igdb_match, 'selected');
  });

  it('POST /games con igdb_id inválido responde 400', async () => {
    const consola = await firstConsole();
    const res = await request(getApp()).post('/games').set('Authorization', getAuth())
      .send({ title: `IGDB invalido ${Date.now()}`, console_id: consola.id, igdb_id: 'abc' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /igdb_id/);
  });

  it('POST /games sin igdb_id deja igdb_id e igdb_match en null', async () => {
    const consola = await firstConsole();
    const res = await request(getApp()).post('/games').set('Authorization', getAuth())
      .send({ title: `IGDB sin id ${Date.now()}`, console_id: consola.id });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.game.igdb_id, null);
    assert.equal(res.body.game.igdb_match, null);
  });

  it('PUT /games/:id sin igdb_id conserva igdb_id e igdb_match', async () => {
    const consola = await firstConsole();
    const title = `IGDB put ${Date.now()}`;
    const created = await request(getApp()).post('/games').set('Authorization', getAuth())
      .send({ title, console_id: consola.id, igdb_id: 99 });
    const id = created.body.game.id;

    const sinId = await request(getApp()).put(`/games/${id}`).set('Authorization', getAuth())
      .send({ title, console_id: consola.id, hours_played: 5 });
    assert.equal(sinId.status, 200, JSON.stringify(sinId.body));
    assert.equal(sinId.body.game.igdb_id, 99);
    assert.equal(sinId.body.game.igdb_match, 'selected');

    const conId = await request(getApp()).put(`/games/${id}`).set('Authorization', getAuth())
      .send({ title, console_id: consola.id, igdb_id: 100 });
    assert.equal(conId.status, 200, JSON.stringify(conId.body));
    assert.equal(conId.body.game.igdb_id, 100);
    assert.equal(conId.body.game.igdb_match, 'selected');
  });

  it('export e import conservan igdb_id e igdb_match', async () => {
    const consola = await firstConsole();
    const title = `IGDB import ${Date.now()}`;
    const imp = await request(getApp()).post('/import').set('Authorization', getAuth())
      .send({ games: [{ title, console_name: consola.name, igdb_id: 421, igdb_match: 'manual' }] });
    assert.equal(imp.status, 200);
    assert.equal(imp.body.imported_games, 1);

    const exp = await request(getApp()).get('/export').set('Authorization', getAuth());
    const g = exp.body.games.find((x) => x.title === title);
    assert.ok(g, 'el juego está en el export');
    assert.equal(g.igdb_id, 421);
    assert.equal(g.igdb_match, 'manual');
  });
});
