import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth, getTestConsoleId } from '../helpers/setup.js';
import { getDatabase } from '../../../db/database.js';

const db = () => getDatabase();

async function sagaGame(igdbId, sagaId, name, year, cover = null) {
  await db().query(
    'INSERT INTO saga_games (igdb_id, saga_id, name, release_year, game_type, cover_url, versions) VALUES (?, ?, ?, ?, 0, ?, ?)',
    [igdbId, sagaId, name, year, cover, '[]']
  );
}

const archive = (igdbId, auth = getAuth()) => {
  const req = request(getApp()).put(`/sagas/games/${igdbId}/archive`);
  return auth ? req.set('Authorization', auth) : req;
};
const unarchive = (igdbId, auth = getAuth()) => {
  const req = request(getApp()).delete(`/sagas/games/${igdbId}/archive`);
  return auth ? req.set('Authorization', auth) : req;
};
const allIds = (detail) => detail.groups.flatMap((g) => g.games.map((x) => x.igdb_id));

describe('Archivar juegos de una saga', () => {
  before(async () => {
    await db().query("INSERT INTO sagas (id, name, refreshed_at) VALUES (39, 'Final Fantasy', NULL)");
    await sagaGame(421, 39, 'Final Fantasy IX', 2000, 'https://img/ix.jpg');
    await sagaGame(422, 39, 'Final Fantasy X', 2001);
    await sagaGame(423, 39, 'Chocobo Racing', 1999);
    await sagaGame(424, 39, 'Record Keeper', 2014);
    await db().query(
      'INSERT INTO games (title, console_id, completed, igdb_id, igdb_match) VALUES (?, ?, 1, 421, ?)',
      ['FFIX', getTestConsoleId(), 'auto']
    );
    await db().query(
      'INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id, resolved_at) VALUES (421, 421, 39, ?)',
      [new Date().toISOString()]
    );
  });

  it('el detalle trae la lista de archivados vacía al principio', async () => {
    const res = await request(getApp()).get('/sagas/39');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.archived, []);
    assert.deepEqual(res.body.counts, { completed: 1, pending: 0, missing: 3, total: 4 });
  });

  it('archivar requiere sesión', async () => {
    assert.equal((await archive(423, null)).status, 401);
    assert.equal((await unarchive(423, null)).status, 401);
  });

  it('archivar un juego lo saca de la grilla y de los totales, y lo lista como archivado', async () => {
    const res = await archive(423);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.counts, { completed: 1, pending: 0, missing: 2, total: 3 });
    assert.ok(!allIds(res.body).includes(423));
    assert.deepEqual(res.body.archived, [{ igdb_id: 423, name: 'Chocobo Racing', release_year: 1999, cover_url: null }]);

    const list = await request(getApp()).get('/sagas');
    assert.deepEqual(list.body.sagas[0].counts, { completed: 1, pending: 0, missing: 2, total: 3 });
  });

  it('archivar dos veces el mismo juego no falla', async () => {
    const res = await archive(423);
    assert.equal(res.status, 200);
    assert.equal(res.body.archived.length, 1);
  });

  it('se puede archivar un juego registrado: deja de contar como completado', async () => {
    const res = await archive(421);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.counts, { completed: 0, pending: 0, missing: 2, total: 2 });
    assert.deepEqual(res.body.archived.map((g) => g.igdb_id), [423, 421]);
    const detail = await request(getApp()).get('/sagas/39');
    assert.equal(detail.status, 200, 'la saga sigue apareciendo porque el juego sigue registrado');
  });

  it('el archivo sobrevive a que el caché de la saga se vuelva a escribir', async () => {
    await db().query('DELETE FROM saga_games WHERE saga_id = 39');
    await sagaGame(421, 39, 'Final Fantasy IX', 2000, 'https://img/ix.jpg');
    await sagaGame(422, 39, 'Final Fantasy X', 2001);
    await sagaGame(423, 39, 'Chocobo Racing', 1999);
    await sagaGame(424, 39, 'Record Keeper', 2014);
    const res = await request(getApp()).get('/sagas/39');
    assert.deepEqual(allIds(res.body).sort(), [422, 424]);
    assert.equal(res.body.archived.length, 2);
  });

  it('restaurar devuelve el juego a la grilla y a los totales', async () => {
    const res = await unarchive(421);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.counts, { completed: 1, pending: 0, missing: 2, total: 3 });
    assert.deepEqual(res.body.archived.map((g) => g.igdb_id), [423]);
    assert.equal((await unarchive(421)).status, 200, 'restaurar algo no archivado no falla');
  });

  it('archivar o restaurar un juego que no está en ninguna saga responde 404', async () => {
    for (const id of ['999999', 'abc', '0']) {
      assert.equal((await archive(id)).status, 404, id);
      assert.equal((await unarchive(id)).status, 404, id);
    }
  });
});
