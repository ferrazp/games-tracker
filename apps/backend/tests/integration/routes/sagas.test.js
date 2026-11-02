import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth, getTestConsoleId } from '../helpers/setup.js';
import { getDatabase } from '../../../db/database.js';

const db = () => getDatabase();

async function insertGame(title, { igdbId = null, match = null, completed = 0, candidates = null } = {}) {
  const res = await db().query(
    'INSERT INTO games (title, console_id, completed, igdb_id, igdb_match, igdb_candidates) VALUES (?, ?, ?, ?, ?, ?)',
    [title, getTestConsoleId(), completed, igdbId, match, candidates]
  );
  return res.lastID;
}

async function resolve(igdbId, canonical, sagaId) {
  await db().query(
    'INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id, resolved_at) VALUES (?, ?, ?, ?)',
    [igdbId, canonical, sagaId, new Date().toISOString()]
  );
}

async function sagaGame(igdbId, sagaId, name, year, cover, versions = []) {
  await db().query(
    'INSERT INTO saga_games (igdb_id, saga_id, name, release_year, game_type, cover_url, versions) VALUES (?, ?, ?, ?, 0, ?, ?)',
    [igdbId, sagaId, name, year, cover, JSON.stringify(versions)]
  );
}

let pendingGameId;
let unresolvedGameId;

describe('API de sagas', () => {
  before(async () => {
    await db().query("INSERT INTO sagas (id, name, refreshed_at) VALUES (39, 'Final Fantasy', NULL)");
    await db().query("INSERT INTO sagas (id, name, refreshed_at) VALUES (50, 'Tales of', NULL)");
    await db().query("INSERT INTO sagas (id, name, refreshed_at) VALUES (77, 'Sin registrados', NULL)");

    await sagaGame(421, 39, 'Final Fantasy IX', 2000, 'https://img/ix.jpg', [{ label: 'PlayStation 1', year: 2000 }]);
    await sagaGame(422, 39, 'Final Fantasy X', 2001, 'https://img/x.jpg');
    await sagaGame(423, 39, 'Final Fantasy VII', 1997, null);
    await sagaGame(600, 50, 'Tales of Symphonia', 2003, 'https://img/sym.jpg');
    await sagaGame(700, 77, 'Juego solo en el cache', 2010, null);

    await insertGame('FFIX', { igdbId: 421, match: 'auto', completed: 1 });
    pendingGameId = await insertGame('FFX', { igdbId: 422, match: 'selected', completed: 0 });
    await insertGame('Symphonia', { igdbId: 600, match: 'manual', completed: 1 });
    await resolve(421, 421, 39);
    await resolve(422, 422, 39);
    await resolve(600, 600, 50);
    // Port del mismo juego canónico (otra versión, otro id de IGDB): no debe contarse dos veces.
    await insertGame('Symphonia (port)', { igdbId: 601, match: 'selected', completed: 0 });
    await resolve(601, 600, 50);

    unresolvedGameId = await insertGame('Juego raro', {
      match: 'unresolved',
      candidates: JSON.stringify([{ igdb_id: 9, name: 'Raro', year: 2001, platforms: [], cover_url: null }]),
    });

    await db().query(
      "INSERT INTO game_catalog (igdb_id, title, console_name, release_date) VALUES (?, 'Final Fantasy IX', 'PlayStation 4', ?)",
      [5421, Date.UTC(2017, 5, 1) / 1000]
    );
  });

  it('GET /sagas lista solo sagas con juegos registrados, ordenadas por cantidad', async () => {
    const res = await request(getApp()).get('/sagas');
    assert.equal(res.status, 200);
    assert.equal(res.body.configured, false);
    assert.equal(res.body.unresolved_count, 1);
    assert.deepEqual(res.body.sagas.map((s) => s.name), ['Final Fantasy', 'Tales of']);
    assert.deepEqual(res.body.sagas[0].counts, { completed: 1, pending: 1, missing: 1, total: 3 });
    assert.deepEqual(res.body.sagas[1].counts, { completed: 1, pending: 0, missing: 0, total: 1 });
    assert.deepEqual(res.body.sagas[0].covers.sort(), ['https://img/ix.jpg', 'https://img/x.jpg']);
    assert.deepEqual(res.body.sagas[1].covers, ['https://img/sym.jpg']);
  });

  it('dos juegos registrados con el mismo canónico se cuentan una vez y sus covers no se repiten', async () => {
    const list = await request(getApp()).get('/sagas');
    const tales = list.body.sagas.find((s) => s.id === 50);
    assert.deepEqual(tales.counts, { completed: 1, pending: 0, missing: 0, total: 1 });
    assert.deepEqual(tales.covers, ['https://img/sym.jpg']);
    const detail = await request(getApp()).get('/sagas/50');
    assert.deepEqual(detail.body.counts, { completed: 1, pending: 0, missing: 0, total: 1 });
  });

  it('GET /sagas/39 agrupa por año e indica el juego faltante', async () => {
    const res = await request(getApp()).get('/sagas/39');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.groups.map((g) => g.year), [1997, 2000, 2001]);
    const ff7 = res.body.groups[0].games[0];
    assert.equal(ff7.name, 'Final Fantasy VII');
    assert.equal(ff7.status, 'missing');
    assert.equal(res.body.groups[1].games[0].status, 'completed');
    assert.equal(res.body.groups[2].games[0].status, 'pending');
  });

  it('GET /sagas/999 y GET /sagas/77 (sin registrados) responden 404', async () => {
    for (const id of ['999', '77', 'abc']) {
      const res = await request(getApp()).get(`/sagas/${id}`);
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, { error: 'Saga no encontrada' });
    }
  });

  it('GET /sagas/games/421/suggest une versiones del cache y del catálogo', async () => {
    const res = await request(getApp()).get('/sagas/games/421/suggest');
    assert.equal(res.status, 200);
    assert.equal(res.body.igdb_id, 421);
    assert.equal(res.body.name, 'Final Fantasy IX');
    assert.equal(res.body.release_year, 2000);
    assert.deepEqual(res.body.versions, [
      { label: 'PlayStation 1', year: 2000 },
      { label: 'PlayStation 4', year: 2017 },
    ]);
    assert.equal(res.body.suggested, 'PlayStation 4');
    assert.equal(res.body.links.length, 5);
  });

  it('GET /sagas/games/:igdbId/suggest responde 404 si el juego no está en el cache', async () => {
    const res = await request(getApp()).get('/sagas/games/123456/suggest');
    assert.equal(res.status, 404);
  });

  it('POST /sagas/:id/refresh exige JWT y credenciales de IGDB', async () => {
    const sinToken = await request(getApp()).post('/sagas/39/refresh');
    assert.equal(sinToken.status, 401);
    const sinCreds = await request(getApp()).post('/sagas/39/refresh').set('Authorization', getAuth());
    assert.equal(sinCreds.status, 503);
    assert.deepEqual(sinCreds.body, { error: 'Falta configurar las credenciales de IGDB' });
  });

  it('POST /sagas/:id/refresh responde 404 si la saga no existe', async () => {
    const { config } = await import('../../../src/config.js');
    const before = config.twitch.hasCredentials;
    config.twitch.hasCredentials = true;
    try {
      const res = await request(getApp()).post('/sagas/424242/refresh').set('Authorization', getAuth());
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: 'Saga no encontrada' });
    } finally {
      config.twitch.hasCredentials = before;
    }
  });

  it('GET /sagas/unresolved exige JWT y devuelve los candidatos parseados', async () => {
    const sinToken = await request(getApp()).get('/sagas/unresolved');
    assert.equal(sinToken.status, 401);
    const res = await request(getApp()).get('/sagas/unresolved').set('Authorization', getAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, unresolvedGameId);
    assert.equal(res.body[0].title, 'Juego raro');
    assert.equal(res.body[0].console_name, 'Test Console');
    assert.equal(res.body[0].candidates[0].igdb_id, 9);
  });

  it('PUT /games/:id/igdb valida el body y el juego', async () => {
    const sinToken = await request(getApp()).put(`/games/${pendingGameId}/igdb`).send({ igdb_id: 1 });
    assert.equal(sinToken.status, 401);
    const bads = [{}, { igdb_id: 'x' }, { igdb_id: 1.5 }, { igdb_id: -3 }, { igdb_id: 0 },
      { igdb_id: true }, { igdb_id: '0x10' }, { igdb_id: '1e3' }, { igdb_id: [5] }, { igdb_id: '0' }, { igdb_id: '' }];
    for (const bad of bads) {
      const res = await request(getApp()).put(`/games/${pendingGameId}/igdb`).set('Authorization', getAuth()).send(bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
    const noExiste = await request(getApp()).put('/games/987654/igdb').set('Authorization', getAuth()).send({ igdb_id: 5 });
    assert.equal(noExiste.status, 404);
  });

  it('PUT /games/:id/igdb con un número lo marca manual y limpia los candidatos', async () => {
    const res = await request(getApp()).put(`/games/${unresolvedGameId}/igdb`).set('Authorization', getAuth()).send({ igdb_id: 9 });
    assert.equal(res.status, 200);
    const { rows } = await db().query('SELECT igdb_id, igdb_match, igdb_candidates FROM games WHERE id = ?', [unresolvedGameId]);
    assert.equal(rows[0].igdb_id, 9);
    assert.equal(rows[0].igdb_match, 'manual');
    assert.equal(rows[0].igdb_candidates, null);
  });

  it('PUT /games/:id/igdb acepta el id como string de dígitos', async () => {
    const res = await request(getApp()).put(`/games/${unresolvedGameId}/igdb`).set('Authorization', getAuth()).send({ igdb_id: '9' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.igdb_id, 9);
    const { rows } = await db().query('SELECT igdb_id, igdb_match FROM games WHERE id = ?', [unresolvedGameId]);
    assert.equal(rows[0].igdb_id, 9);
    assert.equal(rows[0].igdb_match, 'manual');
  });

  it('PUT /games/:id/igdb con null saca al juego de su saga', async () => {
    const res = await request(getApp()).put(`/games/${pendingGameId}/igdb`).set('Authorization', getAuth()).send({ igdb_id: null });
    assert.equal(res.status, 200);
    const { rows } = await db().query('SELECT igdb_id, igdb_match FROM games WHERE id = ?', [pendingGameId]);
    assert.equal(rows[0].igdb_id, null);
    assert.equal(rows[0].igdb_match, 'none');

    const list = await request(getApp()).get('/sagas');
    const ff = list.body.sagas.find((s) => s.id === 39);
    assert.deepEqual(ff.counts, { completed: 1, pending: 0, missing: 2, total: 3 });
  });
});
