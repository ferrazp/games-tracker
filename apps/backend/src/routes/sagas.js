import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDatabase, DB_TYPE } from '../../db/database.js';
import logger from '../../db/logger.js';
import { config } from '../config.js';
import { requireJWT } from '../middleware/auth.js';
import { createIgdbClient } from '../services/igdb-client.js';
import { syncSagas, runSagaJobs, getStatusByCanonical, sql } from '../services/sagas-sync.js';
import { buildSagaDetail, suggestedVersion, searchLinks, releaseYear } from '../services/sagas-logic.js';
import { parseIgdbId } from '../validators/game.js';

const router = Router();

// Límite para las rutas con sesión (las que escriben o llaman a IGDB).
const sessionLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos, probá de nuevo en un rato.' }
});

const MAX_COVERS = 3;
const REGISTERED = "(g.igdb_match IS NULL OR g.igdb_match NOT IN ('none', 'unresolved'))";

let igdbClient = null;
// Cliente de IGDB compartido (se crea la primera vez que hace falta).
export function getIgdbClient() {
  if (!igdbClient) igdbClient = createIgdbClient();
  return igdbClient;
}

// Corre los jobs de sagas en segundo plano, sin esperar, para que un juego nuevo o
// editado aparezca sin esperar al job diario. runSagaJobs nunca corre dos a la vez.
export function triggerSagaJobs(db) {
  if (!config.twitch.hasCredentials) return;
  runSagaJobs(db, getIgdbClient(), logger).catch((err) => logger.error({ err }, 'Background saga jobs failed'));
}

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseJson(text, fallback) {
  if (text == null) return fallback;
  if (typeof text !== 'string') return text;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Juegos registrados con su saga y su juego canónico.
async function registeredByCanonical(db) {
  const { rows } = await db.query(
    `SELECT DISTINCT r.saga_id, r.canonical_igdb_id
     FROM games g JOIN igdb_resolution r ON r.igdb_id = g.igdb_id
     WHERE r.saga_id IS NOT NULL AND ${REGISTERED}`
  );
  return rows.map((r) => ({ sagaId: Number(r.saga_id), canonical: Number(r.canonical_igdb_id) }));
}

// Juegos de la saga; los archivados por el usuario quedan afuera (o solo ellos, con archived).
async function loadSagaGames(db, sagaId, { archived = false } = {}) {
  const { rows } = await db.query(
    sql(db, `SELECT igdb_id, name, release_year, cover_url FROM saga_games
             WHERE saga_id = ? AND igdb_id ${archived ? '' : 'NOT '}IN (SELECT igdb_id FROM saga_archived)
             ORDER BY ${archived ? 'name ASC' : 'release_year ASC'}, igdb_id ASC`),
    [sagaId]
  );
  return rows.map((r) => ({ ...r, igdb_id: Number(r.igdb_id) }));
}

async function sagaDetail(db, sagaId) {
  const { rows } = await db.query(sql(db, 'SELECT id, name FROM sagas WHERE id = ?'), [sagaId]);
  if (rows.length === 0) return null;
  const registered = await registeredByCanonical(db);
  if (!registered.some((r) => r.sagaId === sagaId)) return null;
  const status = await getStatusByCanonical(db);
  const saga = { id: Number(rows[0].id), name: rows[0].name };
  const archived = (await loadSagaGames(db, sagaId, { archived: true })).map((g) => ({
    igdb_id: g.igdb_id,
    name: g.name,
    release_year: g.release_year ?? null,
    cover_url: g.cover_url ?? null,
  }));
  return { ...buildSagaDetail(saga, await loadSagaGames(db, sagaId), status), archived };
}

// Saga del juego en el caché, o null si no está en ninguna.
async function sagaOfGame(db, igdbId) {
  const { rows } = await db.query(sql(db, 'SELECT saga_id FROM saga_games WHERE igdb_id = ?'), [igdbId]);
  return rows.length ? Number(rows[0].saga_id) : null;
}

// Archivar (PUT) o restaurar (DELETE) un juego de una saga. Responde el detalle de la saga.
async function setArchived(req, res, archive) {
  try {
    const igdbId = parseId(req.params.igdbId);
    const db = getDatabase();
    const sagaId = igdbId ? await sagaOfGame(db, igdbId) : null;
    if (!sagaId) return res.status(404).json({ error: 'Juego no encontrado' });
    if (archive) {
      const insert = DB_TYPE === 'sqlite'
        ? 'INSERT OR IGNORE INTO saga_archived (igdb_id) VALUES (?)'
        : 'INSERT INTO saga_archived (igdb_id) VALUES ($1) ON CONFLICT (igdb_id) DO NOTHING';
      await db.query(insert, [igdbId]);
    } else {
      await db.query(sql(db, 'DELETE FROM saga_archived WHERE igdb_id = ?'), [igdbId]);
    }
    const detail = await sagaDetail(db, sagaId);
    if (!detail) return res.status(404).json({ error: 'Saga no encontrada' });
    res.json(detail);
  } catch (error) {
    logger.error({ err: error }, 'Error archiving saga game');
    res.status(500).json({ error: 'No se pudo archivar el juego' });
  }
}

router.get('/sagas', async (req, res) => {
  try {
    const db = getDatabase();
    const registered = await registeredByCanonical(db);
    const canonicalBySaga = new Map();
    for (const { sagaId, canonical } of registered) {
      if (!canonicalBySaga.has(sagaId)) canonicalBySaga.set(sagaId, new Set());
      canonicalBySaga.get(sagaId).add(canonical);
    }

    const status = await getStatusByCanonical(db);
    const { rows: sagaRows } = await db.query('SELECT id, name FROM sagas');
    const sagas = [];
    for (const row of sagaRows) {
      const id = Number(row.id);
      const mine = canonicalBySaga.get(id);
      if (!mine) continue;
      const games = await loadSagaGames(db, id);
      const { counts } = buildSagaDetail({ id, name: row.name }, games, status);
      const covers = games
        .filter((g) => mine.has(g.igdb_id) && g.cover_url)
        .slice(0, MAX_COVERS)
        .map((g) => g.cover_url);
      sagas.push({ id, name: row.name, counts, covers });
    }
    sagas.sort((a, b) =>
      (b.counts.completed + b.counts.pending) - (a.counts.completed + a.counts.pending)
      || a.name.localeCompare(b.name));

    const { rows: unresolved } = await db.query(
      "SELECT COUNT(*) AS n FROM games WHERE igdb_match = 'unresolved'"
    );
    res.json({
      configured: config.twitch.hasCredentials,
      unresolved_count: Number(unresolved[0].n),
      sagas,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching sagas');
    res.status(500).json({ error: 'Error fetching sagas' });
  }
});

router.get('/sagas/unresolved', sessionLimiter, requireJWT, async (req, res) => {
  try {
    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT g.id, g.title, c.name AS console_name, g.igdb_candidates
       FROM games g LEFT JOIN consoles c ON g.console_id = c.id
       WHERE g.igdb_match = 'unresolved'
       ORDER BY g.title ASC, g.id ASC`
    );
    res.json(rows.map((r) => ({
      id: r.id,
      title: r.title,
      console_name: r.console_name ?? null,
      candidates: parseJson(r.igdb_candidates, []),
    })));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching unresolved games');
    res.status(500).json({ error: 'Error fetching unresolved games' });
  }
});

router.get('/sagas/games/:igdbId/suggest', async (req, res) => {
  try {
    const igdbId = parseId(req.params.igdbId);
    if (!igdbId) return res.status(404).json({ error: 'Juego no encontrado' });
    const db = getDatabase();
    const { rows } = await db.query(
      sql(db, 'SELECT igdb_id, name, release_year, versions FROM saga_games WHERE igdb_id = ?'),
      [igdbId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Juego no encontrado' });
    const game = rows[0];

    const versions = parseJson(game.versions, []);
    const seen = new Set(versions.map((v) => v.label));
    const { rows: catalog } = await db.query(
      sql(db, 'SELECT console_name, release_date FROM game_catalog WHERE LOWER(title) = LOWER(?) ORDER BY id ASC'),
      [game.name]
    );
    for (const c of catalog) {
      if (!c.console_name || seen.has(c.console_name)) continue;
      seen.add(c.console_name);
      versions.push({ label: c.console_name, year: releaseYear(c.release_date) });
    }

    res.json({
      igdb_id: Number(game.igdb_id),
      name: game.name,
      release_year: game.release_year ?? null,
      versions,
      suggested: suggestedVersion(versions),
      links: searchLinks(game.name),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching game suggestion');
    res.status(500).json({ error: 'Error fetching game suggestion' });
  }
});

router.put('/sagas/games/:igdbId/archive', sessionLimiter, requireJWT, (req, res) => setArchived(req, res, true));
router.delete('/sagas/games/:igdbId/archive', sessionLimiter, requireJWT, (req, res) => setArchived(req, res, false));

router.get('/sagas/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Saga no encontrada' });
    const detail = await sagaDetail(getDatabase(), id);
    if (!detail) return res.status(404).json({ error: 'Saga no encontrada' });
    res.json(detail);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching saga');
    res.status(500).json({ error: 'Error fetching saga' });
  }
});

router.post('/sagas/:id/refresh', sessionLimiter, requireJWT, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Saga no encontrada' });
  if (!config.twitch.hasCredentials) {
    return res.status(503).json({ error: 'Falta configurar las credenciales de IGDB' });
  }
  const db = getDatabase();
  try {
    const { rows } = await db.query(sql(db, 'SELECT id FROM sagas WHERE id = ?'), [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Saga no encontrada' });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching saga');
    return res.status(500).json({ error: 'Error fetching saga' });
  }
  try {
    await syncSagas(db, getIgdbClient(), { onlySagaId: id });
  } catch (error) {
    logger.error({ err: error, sagaId: id }, 'Error refreshing saga from IGDB');
    return res.status(502).json({ error: 'No se pudo actualizar la saga desde IGDB' });
  }
  try {
    const detail = await sagaDetail(db, id);
    if (!detail) return res.status(404).json({ error: 'Saga no encontrada' });
    res.json(detail);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching saga');
    res.status(500).json({ error: 'Error fetching saga' });
  }
});

router.put('/games/:id/igdb', sessionLimiter, requireJWT, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ error: 'Game not found' });
    const isNull = req.body?.igdb_id === null;
    const igdbId = isNull ? null : parseIgdbId(req.body?.igdb_id);
    if (!isNull && igdbId === null) {
      return res.status(400).json({ error: 'igdb_id must be a positive integer or null' });
    }

    const db = getDatabase();
    const result = isNull
      ? await db.query(sql(db, "UPDATE games SET igdb_id = NULL, igdb_match = 'none', igdb_candidates = NULL WHERE id = ?"), [id])
      : await db.query(sql(db, "UPDATE games SET igdb_id = ?, igdb_match = 'manual', igdb_candidates = NULL WHERE id = ?"), [igdbId, id]);
    const affected = DB_TYPE === 'sqlite' ? result.changes : result.rowCount;
    if (!affected) return res.status(404).json({ error: 'Game not found' });

    triggerSagaJobs(db);
    res.json({ id, igdb_id: isNull ? null : igdbId, igdb_match: isNull ? 'none' : 'manual' });
  } catch (error) {
    logger.error({ err: error }, 'Error linking game to IGDB');
    res.status(500).json({ error: 'Error linking game to IGDB' });
  }
});

export default router;
