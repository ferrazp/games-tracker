import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/setup.js';
import { getDatabase } from '../../../db/database.js';
import {
  backfillIgdbIds,
  syncSagas,
  getStatusByCanonical,
  runSagaJobs,
} from '../../../src/services/sagas-sync.js';

const db = getDatabase();
const seededGames = [];
const seededCatalog = [];

async function consoleId(name) {
  const { rows } = await db.query('SELECT id FROM consoles WHERE name = ?', [name]);
  return rows[0].id;
}

async function addGame({ title, console = 'PC', completed = 0, igdb_id = null, igdb_match = null }) {
  const cid = await consoleId(console);
  const res = await db.query(
    'INSERT INTO games (title, console_id, completed, igdb_id, igdb_match) VALUES (?, ?, ?, ?, ?)',
    [title, cid, completed, igdb_id, igdb_match]
  );
  seededGames.push(res.lastID);
  return res.lastID;
}

async function addCatalog(igdb_id, title, console_name) {
  await db.query(
    'INSERT INTO game_catalog (igdb_id, title, console_name) VALUES (?, ?, ?)',
    [igdb_id, title, console_name]
  );
  seededCatalog.push(igdb_id);
}

async function gameRow(id) {
  const { rows } = await db.query('SELECT igdb_id, igdb_match, igdb_candidates FROM games WHERE id = ?', [id]);
  return rows[0];
}

afterEach(async () => {
  for (const id of seededGames.splice(0)) await db.query('DELETE FROM games WHERE id = ?', [id]);
  for (const id of seededCatalog.splice(0)) await db.query('DELETE FROM game_catalog WHERE igdb_id = ?', [id]);
  await db.query('DELETE FROM igdb_resolution');
  await db.query('DELETE FROM sagas');
  await db.query('DELETE FROM saga_games');
});

function fakeIgdb({ games = {}, members = {}, searchResults = {} } = {}) {
  return {
    gamesByIds: mock.fn(async (ids) => ids.map((id) => games[id]).filter(Boolean)),
    collectionMembers: mock.fn(async (cid) => members[cid] ?? []),
    search: mock.fn(async (title) => searchResults[title] ?? []),
  };
}

// Fixtures de IGDB
const ids = (n, start) => Array.from({ length: n }, (_, i) => start + i);
const FF = { id: 39, name: 'Final Fantasy', games: ids(6, 1) };
const DISSIDIA = { id: 2440, name: 'Dissidia', games: ids(10, 100) };

const ffX = {
  id: 418,
  name: 'Final Fantasy X',
  game_type: 0,
  first_release_date: 995500800, // 2001
  cover: { url: '//images.igdb.com/igdb/image/upload/t_thumb/ffx.jpg' },
  platforms: [{ name: 'PlayStation 2' }],
  collections: [FF],
  ports: [{ name: 'FF X port', platforms: [{ name: 'PlayStation 4' }], first_release_date: 1431388800 }], // 2015
  remasters: [{
    name: 'Final Fantasy X HD Remaster',
    platforms: [{ name: 'PlayStation 3' }, { name: 'PlayStation 2' }],
    first_release_date: 1388016000, // 2013
  }],
};
const ffXHd = { id: 11000, name: 'Final Fantasy X HD Remaster', game_type: 9, version_parent: 418, collections: [FF] };
const ffIX = { id: 415, name: 'Final Fantasy IX', game_type: 0, first_release_date: 963446400, platforms: [{ name: 'PlayStation 1' }], collections: [FF] };
const ffVIIRemake = { id: 103281, name: 'Final Fantasy VII Remake', game_type: 8, first_release_date: 1586476800, collections: [FF] };
const ffDlc = { id: 5000, name: 'Final Fantasy X DLC', game_type: 1, collections: [FF] };
const dissidia = { id: 5001, name: 'Dissidia Final Fantasy', game_type: 0, collections: [FF, DISSIDIA] };

const sagaIgdb = () => fakeIgdb({
  games: { 418: ffX, 11000: ffXHd },
  members: { 39: [ffIX, ffX, ffVIIRemake, ffDlc, dissidia] },
});

describe('backfillIgdbIds', () => {
  it('asigna el id del catálogo de la consola del juego sin buscar en IGDB', async () => {
    await addCatalog(427, 'Final Fantasy VII', 'PlayStation 1');
    await addCatalog(207021, 'Final Fantasy VII', 'PC');
    const id = await addGame({ title: 'final fantasy vii', console: 'PC' });
    const igdb = fakeIgdb();

    const result = await backfillIgdbIds(db, igdb);

    const row = await gameRow(id);
    assert.equal(row.igdb_id, 207021);
    assert.equal(row.igdb_match, 'auto');
    assert.equal(igdb.search.mock.callCount(), 0);
    assert.deepEqual(result, { auto: 1, unresolved: 0 });
  });

  it('sin catálogo y con dos resultados de título igual queda unresolved con candidatos', async () => {
    const id = await addGame({ title: 'Ghostbound', console: 'PlayStation 2' });
    const igdb = fakeIgdb({
      searchResults: {
        Ghostbound: [
          { id: 1, name: 'Ghostbound', first_release_date: 995500800, platforms: [{ name: 'PlayStation 2' }], cover: { url: '//images.igdb.com/igdb/image/upload/t_thumb/a.jpg' } },
          { id: 2, name: 'GHOSTBOUND', platforms: [{ name: 'PC' }] },
        ],
      },
    });

    const result = await backfillIgdbIds(db, igdb);

    const row = await gameRow(id);
    assert.equal(row.igdb_id, null);
    assert.equal(row.igdb_match, 'unresolved');
    const candidates = JSON.parse(row.igdb_candidates);
    assert.equal(candidates.length, 2);
    assert.deepEqual(candidates[0], {
      igdb_id: 1,
      name: 'Ghostbound',
      year: 2001,
      platforms: ['PlayStation 2'],
      cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/a.jpg',
    });
    assert.deepEqual(candidates[1], { igdb_id: 2, name: 'GHOSTBOUND', year: null, platforms: ['PC'], cover_url: null });
    assert.deepEqual(result, { auto: 0, unresolved: 1 });
    assert.deepEqual(igdb.search.mock.calls[0].arguments, ['Ghostbound', [8]]);

    await backfillIgdbIds(db, igdb);
    assert.equal(igdb.search.mock.callCount(), 1);
  });

  it('un juego con igdb_id y sin igdb_match conserva el id como selected sin buscar', async () => {
    await addCatalog(5555, 'Viejo Importado', 'PC');
    const id = await addGame({ title: 'Viejo Importado', console: 'PC', igdb_id: 1234 });
    const igdb = fakeIgdb();

    await backfillIgdbIds(db, igdb);

    const row = await gameRow(id);
    assert.equal(row.igdb_id, 1234);
    assert.equal(row.igdb_match, 'selected');
    assert.equal(igdb.search.mock.callCount(), 0);
  });

  it('un único resultado de título igual en IGDB se asigna como auto', async () => {
    const id = await addGame({ title: 'Solo Title', console: 'PC' });
    const igdb = fakeIgdb({
      searchResults: { 'Solo Title': [{ id: 77, name: 'Solo Title' }, { id: 78, name: 'Solo Title 2' }] },
    });

    await backfillIgdbIds(db, igdb);

    const row = await gameRow(id);
    assert.equal(row.igdb_id, 77);
    assert.equal(row.igdb_match, 'auto');
  });
});

describe('syncSagas', () => {
  it('resuelve el remaster a su juego padre y arma la saga con principales y remakes', async () => {
    await addGame({ title: 'Final Fantasy X HD Remaster', igdb_id: 11000, igdb_match: 'selected' });
    const igdb = sagaIgdb();
    const now = new Date('2026-11-02T10:00:00.000Z');

    const result = await syncSagas(db, igdb, { now });

    const { rows: res } = await db.query('SELECT * FROM igdb_resolution WHERE igdb_id = 11000');
    assert.equal(res[0].canonical_igdb_id, 418);
    assert.equal(res[0].saga_id, 39);

    const { rows: sagas } = await db.query('SELECT * FROM sagas');
    assert.equal(sagas.length, 1);
    assert.equal(sagas[0].name, 'Final Fantasy');
    assert.equal(sagas[0].refreshed_at, now.toISOString());

    const { rows: sg } = await db.query('SELECT * FROM saga_games WHERE saga_id = 39 ORDER BY igdb_id');
    assert.deepEqual(sg.map((g) => g.name), ['Final Fantasy IX', 'Final Fantasy X', 'Final Fantasy VII Remake']);
    const x = sg.find((g) => g.igdb_id === 418);
    assert.equal(x.release_year, 2001);
    assert.equal(x.game_type, 0);
    assert.equal(x.cover_url, 'https://images.igdb.com/igdb/image/upload/t_cover_big/ffx.jpg');
    assert.deepEqual(JSON.parse(x.versions), [
      { label: 'PlayStation 2', year: 2013 },
      { label: 'PlayStation 3', year: 2013 },
      { label: 'PlayStation 4', year: 2015 },
    ]);
    assert.equal(sg.find((g) => g.igdb_id === 103281).cover_url, null);
    assert.deepEqual(result, { resolved: 1, refreshed: 1 });
  });

  it('no vuelve a refrescar una saga reciente salvo que se pida con onlySagaId', async () => {
    await addGame({ title: 'Final Fantasy X', igdb_id: 418, igdb_match: 'selected' });
    const igdb = sagaIgdb();
    const now = new Date('2026-11-02T10:00:00.000Z');
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await syncSagas(db, igdb, { now });
    const second = await syncSagas(db, igdb, { now: tomorrow });
    assert.equal(igdb.collectionMembers.mock.callCount(), 1);
    assert.equal(igdb.gamesByIds.mock.callCount(), 1);
    assert.deepEqual(second, { resolved: 0, refreshed: 0 });

    const third = await syncSagas(db, igdb, { now: tomorrow, onlySagaId: 39 });
    assert.equal(igdb.collectionMembers.mock.callCount(), 2);
    assert.deepEqual(third, { resolved: 0, refreshed: 1 });
  });

  it('refresca las sagas con más de maxAgeDays', async () => {
    await addGame({ title: 'Final Fantasy X', igdb_id: 418, igdb_match: 'selected' });
    const igdb = sagaIgdb();
    const now = new Date('2026-11-02T10:00:00.000Z');

    await syncSagas(db, igdb, { now });
    await syncSagas(db, igdb, { now: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000) });
    assert.equal(igdb.collectionMembers.mock.callCount(), 2);
  });

  it('ignora los juegos none y unresolved', async () => {
    await addGame({ title: 'No saga', igdb_id: 418, igdb_match: 'none' });
    await addGame({ title: 'Dudoso', igdb_match: 'unresolved' });
    await addGame({ title: 'Dudoso con id', igdb_id: 415, igdb_match: 'unresolved' });
    const igdb = sagaIgdb();

    const result = await syncSagas(db, igdb);

    assert.equal(igdb.gamesByIds.mock.callCount(), 0);
    assert.deepEqual(result, { resolved: 0, refreshed: 0 });
  });

  it('un DLC de un remaster sube hasta el juego principal', async () => {
    await addGame({ title: 'FF X DLC', igdb_id: 7000, igdb_match: 'selected' });
    const remaster = { id: 21899, name: 'FF X HD', game_type: 9, version_parent: 418 };
    const dlc = { id: 7000, name: 'FF X DLC', game_type: 1, parent_game: { id: 21899 } };
    const igdb = fakeIgdb({
      games: { 418: ffX, 21899: remaster, 7000: dlc },
      members: { 39: [ffX] },
    });

    const result = await syncSagas(db, igdb);

    const { rows } = await db.query('SELECT * FROM igdb_resolution WHERE igdb_id = 7000');
    assert.equal(rows[0].canonical_igdb_id, 418);
    assert.equal(rows[0].saga_id, 39);
    assert.equal(igdb.gamesByIds.mock.callCount(), 3);
    assert.equal(result.resolved, 1);
  });

  it('un bundle sin padres queda unresolved con candidatos y sin resolución', async () => {
    const id = await addGame({ title: 'FF Bundle', console: 'PlayStation 2', igdb_id: 8000, igdb_match: 'selected' });
    const igdb = fakeIgdb({
      games: { 8000: { id: 8000, name: 'FF Bundle', game_type: 3 } },
      searchResults: { 'FF Bundle': [{ id: 8000, name: 'FF Bundle' }, { id: 418, name: 'Final Fantasy X' }] },
    });

    const result = await syncSagas(db, igdb);

    const { rows } = await db.query('SELECT * FROM igdb_resolution WHERE igdb_id = 8000');
    assert.equal(rows.length, 0);
    const row = await gameRow(id);
    assert.equal(row.igdb_match, 'unresolved');
    assert.deepEqual(JSON.parse(row.igdb_candidates).map((c) => c.igdb_id), [8000, 418]);
    assert.deepEqual(igdb.search.mock.calls[0].arguments, ['FF Bundle', [8]]);
    assert.equal(result.resolved, 0);
  });

  it('si IGDB devuelve la saga vacía no la vacía ni la marca refrescada', async () => {
    await db.query("INSERT INTO sagas (id, name, refreshed_at) VALUES (39, 'Final Fantasy', NULL)");
    await db.query("INSERT INTO saga_games (igdb_id, saga_id, name) VALUES (418, 39, 'Final Fantasy X')");
    const igdb = fakeIgdb();

    const result = await syncSagas(db, igdb);

    const { rows: sg } = await db.query('SELECT igdb_id FROM saga_games WHERE saga_id = 39');
    assert.equal(sg.length, 1);
    const { rows: sagas } = await db.query('SELECT refreshed_at FROM sagas WHERE id = 39');
    assert.equal(sagas[0].refreshed_at, null);
    assert.equal(igdb.collectionMembers.mock.callCount(), 1);
    assert.deepEqual(result, { resolved: 0, refreshed: 0 });
  });

  it('las ediciones tipo 0 con version_parent se resuelven a su base y no cuentan como juegos de la saga', async () => {
    const TALES = { id: 112, name: 'Tales of', games: ids(5, 300) };
    const FF16 = { id: 39, name: 'Final Fantasy', games: ids(6, 1) };
    const ffXVI = { id: 136560, name: 'Final Fantasy XVI', game_type: 0, collections: [FF16] };
    const ffXVICollector = { id: 263210, name: "Final Fantasy XVI: Collector's Edition", game_type: 0, version_parent: 136560, collections: [FF16] };
    const tos = { id: 1217, name: 'Tales of Symphonia', game_type: 0, collections: [TALES] };
    const tosRemastered = { id: 103329, name: 'Tales of Symphonia Remastered', game_type: 9, version_parent: 1217, collections: [TALES] };
    const tosChosen = { id: 222001, name: 'Tales of Symphonia Remastered: Chosen Edition', game_type: 0, version_parent: 103329, collections: [TALES] };
    const remakeWithParent = { id: 11169, name: 'Some Remake', game_type: 8, version_parent: 1217, collections: [TALES] };
    await addGame({ title: "Final Fantasy XVI: Collector's Edition", igdb_id: 263210, igdb_match: 'selected' });
    await addGame({ title: 'Tales of Symphonia Remastered: Chosen Edition', igdb_id: 222001, igdb_match: 'selected' });
    const igdb = fakeIgdb({
      games: Object.fromEntries([ffXVI, ffXVICollector, tos, tosRemastered, tosChosen].map((g) => [g.id, g])),
      members: { 39: [ffXVI, ffXVICollector], 112: [tos, tosRemastered, tosChosen, remakeWithParent] },
    });

    await syncSagas(db, igdb);

    const { rows: res } = await db.query('SELECT igdb_id, canonical_igdb_id, saga_id FROM igdb_resolution ORDER BY igdb_id');
    assert.deepEqual(res.map((r) => [r.igdb_id, r.canonical_igdb_id, r.saga_id]), [[222001, 1217, 112], [263210, 136560, 39]]);
    const { rows: sg } = await db.query('SELECT igdb_id, saga_id FROM saga_games ORDER BY igdb_id');
    assert.deepEqual(sg.map((g) => [g.igdb_id, g.saga_id]), [[1217, 112], [11169, 112], [136560, 39]]);
  });

  it('las versiones usan el nombre de consola de la app según el id de plataforma de IGDB', async () => {
    await addGame({ title: 'Final Fantasy IX', igdb_id: 415, igdb_match: 'selected' });
    const ffIXPs1 = { ...ffIX, platforms: [{ id: 7, name: 'PlayStation' }, { id: 999, name: 'Rara' }] };
    const igdb = fakeIgdb({ games: { 415: ffIXPs1 }, members: { 39: [ffIXPs1] } });

    await syncSagas(db, igdb);

    const { rows } = await db.query('SELECT versions FROM saga_games WHERE igdb_id = 415');
    assert.deepEqual(JSON.parse(rows[0].versions), [
      { label: 'PlayStation 1', year: 2000 },
      { label: 'Rara', year: 2000 },
    ]);
  });

  it('guarda la resolución con saga_id nulo si el juego no está en ninguna serie', async () => {
    await addGame({ title: 'Loner', igdb_id: 9000, igdb_match: 'selected' });
    const igdb = fakeIgdb({ games: { 9000: { id: 9000, name: 'Loner', game_type: 0 } } });

    await syncSagas(db, igdb);
    await syncSagas(db, igdb);

    const { rows } = await db.query('SELECT * FROM igdb_resolution WHERE igdb_id = 9000');
    assert.equal(rows[0].canonical_igdb_id, 9000);
    assert.equal(rows[0].saga_id, null);
    assert.equal(igdb.gamesByIds.mock.callCount(), 1);
  });
});

describe('getStatusByCanonical', () => {
  it('el mismo canónico completado una vez y pendiente otra cuenta como completado', async () => {
    await addGame({ title: 'FF X HD', igdb_id: 11000, igdb_match: 'selected', completed: 1 });
    await addGame({ title: 'FF X', igdb_id: 418, igdb_match: 'auto', completed: 0, console: 'PlayStation 2' });
    await addGame({ title: 'Descartado', igdb_id: 6000, igdb_match: 'none', completed: 1 });
    await db.query('INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id) VALUES (?, ?, ?)', [11000, 418, 39]);
    await db.query('INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id) VALUES (?, ?, ?)', [418, 418, 39]);
    await db.query('INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id) VALUES (?, ?, ?)', [6000, 6000, 39]);
    await addGame({ title: 'Dudoso', igdb_id: 6001, igdb_match: 'unresolved', completed: 1 });
    await db.query('INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id) VALUES (?, ?, ?)', [6001, 6001, 39]);

    const status = await getStatusByCanonical(db);

    assert.equal(status.get(418), 'completed');
    assert.equal(status.has(6000), false);
    assert.equal(status.has(6001), false);
  });
});

const fakeLogger = () => ({ error: mock.fn(), info: mock.fn(), warn: mock.fn() });

describe('errores de IGDB aislados', () => {
  it('un título cuyo search lanza no impide procesar el siguiente', async () => {
    const roto = await addGame({ title: 'Roto' });
    const sano = await addGame({ title: 'Sano' });
    const igdb = fakeIgdb({ searchResults: { Sano: [{ id: 501, name: 'Sano' }] } });
    igdb.search = mock.fn(async (title) => {
      if (title === 'Roto') throw new Error('IGDB 500');
      return [{ id: 501, name: 'Sano' }];
    });
    const logger = fakeLogger();

    const result = await backfillIgdbIds(db, igdb, { logger });

    assert.equal((await gameRow(sano)).igdb_id, 501);
    assert.equal((await gameRow(roto)).igdb_match, null, 'queda para la próxima corrida');
    assert.deepEqual(result, { auto: 1, unresolved: 0 });
    assert.equal(logger.error.mock.callCount(), 1);
    assert.equal(logger.error.mock.calls[0].arguments[0].err.message, 'IGDB 500');
  });

  it('un search que lanza al marcar unresolved no impide marcar el siguiente', async () => {
    const a = await addGame({ title: 'Bundle A', igdb_id: 8001, igdb_match: 'selected' });
    const b = await addGame({ title: 'Bundle B', igdb_id: 8002, igdb_match: 'selected' });
    const igdb = fakeIgdb({
      games: { 8001: { id: 8001, game_type: 3 }, 8002: { id: 8002, game_type: 3 } },
    });
    igdb.search = mock.fn(async (title) => {
      if (title === 'Bundle A') throw new Error('IGDB 500');
      return [{ id: 8002, name: 'Bundle B' }];
    });
    const logger = fakeLogger();

    await syncSagas(db, igdb, { logger });

    assert.equal((await gameRow(a)).igdb_match, 'selected');
    assert.equal((await gameRow(b)).igdb_match, 'unresolved');
    assert.equal(logger.error.mock.callCount(), 1);
  });

  it('una saga cuyo collectionMembers lanza no impide refrescar la siguiente', async () => {
    await db.query("INSERT INTO sagas (id, name, refreshed_at) VALUES (39, 'Final Fantasy', NULL), (112, 'Tales of', NULL)");
    const tos = { id: 1217, name: 'Tales of Symphonia', game_type: 0, collections: [{ id: 112, name: 'Tales of', games: [1217] }] };
    const igdb = fakeIgdb();
    igdb.collectionMembers = mock.fn(async (cid) => {
      if (cid === 39) throw new Error('IGDB 500');
      return [tos];
    });
    const logger = fakeLogger();

    const result = await syncSagas(db, igdb, { logger });

    const { rows } = await db.query('SELECT igdb_id FROM saga_games WHERE saga_id = 112');
    assert.deepEqual(rows.map((r) => r.igdb_id), [1217]);
    assert.equal(result.refreshed, 1);
    assert.equal(igdb.collectionMembers.mock.callCount(), 2);
    assert.equal(logger.error.mock.callCount(), 1);
  });

  it('con onlySagaId el error de la saga se propaga (el refresh manual responde 502)', async () => {
    await db.query("INSERT INTO sagas (id, name, refreshed_at) VALUES (39, 'Final Fantasy', NULL)");
    const igdb = fakeIgdb();
    igdb.collectionMembers = mock.fn(async () => { throw new Error('IGDB 500'); });

    await assert.rejects(() => syncSagas(db, igdb, { onlySagaId: 39, logger: fakeLogger() }), { message: 'IGDB 500' });
  });
});

describe('runSagaJobs', () => {
  it('corre syncSagas aunque backfillIgdbIds falle', async () => {
    await addGame({ title: 'Final Fantasy X', igdb_id: 418, igdb_match: 'selected' });
    const brokenDb = Object.create(db);
    brokenDb.query = (text, params) => {
      if (text.includes('WHERE g.igdb_match IS NULL')) return Promise.reject(new Error('backfill roto'));
      return db.query(text, params);
    };
    const igdb = sagaIgdb();
    const logger = fakeLogger();

    await runSagaJobs(brokenDb, igdb, logger);

    assert.equal(logger.error.mock.calls[0].arguments[0].err.message, 'backfill roto');
    const { rows } = await db.query('SELECT canonical_igdb_id FROM igdb_resolution WHERE igdb_id = 418');
    assert.equal(rows[0].canonical_igdb_id, 418);
  });

  it('no corre dos veces en paralelo: la llamada que llega durante una corrida agenda una más al terminar', async () => {
    const first = await addGame({ title: 'Lento Uno' });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let inFlight = 0;
    let maxInFlight = 0;
    const igdb = fakeIgdb();
    igdb.search = mock.fn(async (title) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (title === 'Lento Uno') await gate;
      inFlight -= 1;
      return [{ id: title === 'Lento Uno' ? 601 : 602, name: title }];
    });
    const logger = fakeLogger();

    const p1 = runSagaJobs(db, igdb, logger);
    while (igdb.search.mock.callCount() === 0) await new Promise((r) => setTimeout(r, 5));
    const second = await addGame({ title: 'Lento Dos' });
    const p2 = runSagaJobs(db, igdb, logger);
    const p3 = runSagaJobs(db, igdb, logger);
    await new Promise((r) => setTimeout(r, 50)); // tiempo para que una corrida paralela llegue a IGDB
    release();
    await Promise.all([p1, p2, p3]);

    assert.equal(maxInFlight, 1);
    assert.deepEqual(igdb.search.mock.calls.map((c) => c.arguments[0]), ['Lento Uno', 'Lento Dos']);
    assert.equal((await gameRow(first)).igdb_id, 601);
    assert.equal((await gameRow(second)).igdb_id, 602);
    assert.equal(logger.info.mock.callCount(), 2, 'una corrida más, no dos');
  });

  it('no lanza si IGDB falla y loguea el error', async () => {
    await addGame({ title: 'Final Fantasy X', igdb_id: 418, igdb_match: 'selected' });
    const igdb = sagaIgdb();
    igdb.gamesByIds = mock.fn(async () => { throw new Error('IGDB caído'); });
    const logger = { error: mock.fn(), info: mock.fn(), warn: mock.fn() };

    await runSagaJobs(db, igdb, logger);

    assert.equal(logger.error.mock.callCount(), 1);
    assert.equal(logger.error.mock.calls[0].arguments[0].err.message, 'IGDB caído');
  });
});
