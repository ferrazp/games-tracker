import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth, getTestConsoleId } from '../helpers/setup.js';
import { getDatabase } from '../../../db/database.js';

const db = () => getDatabase();

async function sagaGame(igdbId, sagaId, name, year) {
  await db().query(
    'INSERT INTO saga_games (igdb_id, saga_id, name, release_year, game_type, cover_url, versions) VALUES (?, ?, ?, ?, 0, NULL, ?)',
    [igdbId, sagaId, name, year, '[]']
  );
}

const link = (sagaId, body, auth = getAuth()) => {
  const req = request(getApp()).put(`/sagas/${sagaId}/links`);
  return (auth ? req.set('Authorization', auth) : req).send(body);
};
const unlink = (sagaId, mainId, auth = getAuth()) => {
  const req = request(getApp()).delete(`/sagas/${sagaId}/links/${mainId}`);
  return auth ? req.set('Authorization', auth) : req;
};
const game = (detail, id) => detail.groups.flatMap((g) => g.games).find((g) => g.igdb_id === id);

describe('Unir versiones de un juego en una saga', () => {
  before(async () => {
    await db().query("INSERT INTO sagas (id, name, refreshed_at) VALUES (39, 'Final Fantasy', NULL)");
    await db().query("INSERT INTO sagas (id, name, refreshed_at) VALUES (50, 'Tales of', NULL)");
    await sagaGame(77234, 39, 'Final Fantasy III', 1990);
    await sagaGame(393, 39, 'Final Fantasy III', 2006);
    await sagaGame(426, 39, 'Final Fantasy III', 1994);
    await sagaGame(415, 39, 'Final Fantasy V', 1992);
    await sagaGame(600, 50, 'Tales of Symphonia', 2003);
    for (const [title, igdbId, sagaId] of [['FF III 3D', 393, 39], ['Symphonia', 600, 50]]) {
      await db().query(
        'INSERT INTO games (title, console_id, completed, igdb_id, igdb_match) VALUES (?, ?, 1, ?, ?)',
        [title, getTestConsoleId(), igdbId, 'selected']
      );
      await db().query(
        'INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id, resolved_at) VALUES (?, ?, ?, ?)',
        [igdbId, igdbId, sagaId, new Date().toISOString()]
      );
    }
  });

  it('unir requiere sesión', async () => {
    assert.equal((await link(39, { main_igdb_id: 393, igdb_ids: [77234] }, null)).status, 401);
    assert.equal((await unlink(39, 393, null)).status, 401);
  });

  it('rechaza cuerpos inválidos o juegos de otra saga', async () => {
    const bad = [
      {},
      { main_igdb_id: 393 },
      { main_igdb_id: 393, igdb_ids: [] },
      { main_igdb_id: 393, igdb_ids: ['abc'] },
      { main_igdb_id: 393, igdb_ids: [393] },
      { main_igdb_id: 393, igdb_ids: [600] },
      { main_igdb_id: 999999, igdb_ids: [77234] },
    ];
    for (const body of bad) {
      const res = await link(39, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal((await link(12345, { main_igdb_id: 393, igdb_ids: [77234] })).status, 404);
  });

  it('une el III original con el 3D: los dos cuentan como completados y el total no cambia', async () => {
    const res = await link(39, { main_igdb_id: 393, igdb_ids: [77234] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.counts, { completed: 2, pending: 0, missing: 2, total: 4 });
    assert.equal(game(res.body, 77234).status, 'completed');
    assert.deepEqual(game(res.body, 77234).link, { main_igdb_id: 393, main_name: 'Final Fantasy III', main_year: 2006, is_main: false });
    assert.equal(game(res.body, 393).link.is_main, true);
    assert.equal(game(res.body, 426).link, null);

    const list = await request(getApp()).get('/sagas');
    const ff = list.body.sagas.find((s) => s.id === 39);
    assert.deepEqual(ff.counts, { completed: 2, pending: 0, missing: 2, total: 4 });
  });

  it('cambiar el principal reemplaza el grupo anterior', async () => {
    const res = await link(39, { main_igdb_id: 77234, igdb_ids: [393] });
    assert.equal(res.status, 200);
    assert.equal(game(res.body, 77234).link.is_main, true);
    assert.equal(game(res.body, 393).link.main_igdb_id, 77234);
    const { rows } = await db().query('SELECT COUNT(*) AS n FROM saga_links');
    assert.equal(Number(rows[0].n), 2);
  });

  it('sumar un juego de otro grupo lo mueve y no deja filas huérfanas', async () => {
    await link(39, { main_igdb_id: 415, igdb_ids: [426] });
    const res = await link(39, { main_igdb_id: 77234, igdb_ids: [393, 426] });
    assert.equal(res.status, 200);
    assert.equal(game(res.body, 426).link.main_igdb_id, 77234);
    assert.equal(game(res.body, 415).link, null, 'el grupo de 415 quedó con un solo juego y se borra');
    const { rows } = await db().query('SELECT COUNT(*) AS n FROM saga_links');
    assert.equal(Number(rows[0].n), 3);
  });

  it('separar borra el grupo y vuelven a faltar', async () => {
    const res = await unlink(39, 77234);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.counts, { completed: 1, pending: 0, missing: 3, total: 4 });
    assert.equal(game(res.body, 77234).link, null);
    assert.equal((await unlink(39, 77234)).status, 200, 'separar algo ya separado no falla');
  });
});
