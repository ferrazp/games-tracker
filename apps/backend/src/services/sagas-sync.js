// Completa los IDs de IGDB de los juegos registrados, los resuelve a su juego
// canónico y a su saga, y cachea en la base las sagas con sus juegos.
import { SQLiteClient } from '../../db/database.js';
import { IGDB_PLATFORM_TO_CONSOLE } from './igdb.js';
import {
  SAGA_GAME_TYPES,
  largestCollection,
  canonicalId,
  mergeStatus,
  statusOf,
  releaseYear,
  pickCatalogMatch,
} from './sagas-logic.js';

const MAX_CANDIDATES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const isSqlite = (db) => db instanceof SQLiteClient;

// Las consultas se escriben con `?`; en Postgres se numeran como $1, $2…
function sql(db, text) {
  if (isSqlite(db)) return text;
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

function coverUrl(cover) {
  const url = cover?.url;
  if (!url) return null;
  const big = url.replace('t_thumb', 't_cover_big');
  return big.startsWith('http') ? big : `https:${big}`;
}

const platformNames = (g) => (g.platforms ?? []).map((p) => p.name).filter(Boolean);

function toCandidate(g) {
  return {
    igdb_id: g.id,
    name: g.name,
    year: releaseYear(g.first_release_date),
    platforms: platformNames(g),
    cover_url: coverUrl(g.cover),
  };
}

function platformIdsFor(consoleName) {
  return Object.entries(IGDB_PLATFORM_TO_CONSOLE)
    .filter(([, name]) => consoleName != null && name === consoleName)
    .map(([id]) => Number(id));
}

export async function backfillIgdbIds(db, igdb) {
  const { rows: games } = await db.query(
    `SELECT g.id, g.title, c.name AS console_name
     FROM games g LEFT JOIN consoles c ON g.console_id = c.id
     WHERE g.igdb_match IS NULL`
  );
  const counts = { auto: 0, unresolved: 0 };

  for (const game of games) {
    const { rows: catalog } = await db.query(
      sql(db, 'SELECT igdb_id, title, console_name FROM game_catalog WHERE LOWER(title) = LOWER(?)'),
      [game.title]
    );
    let igdbId = pickCatalogMatch(catalog, game.title, game.console_name);
    let candidates = null;

    if (igdbId == null) {
      const results = await igdb.search(game.title, platformIdsFor(game.console_name));
      const same = results.filter((r) => norm(r.name) === norm(game.title));
      if (same.length === 1) igdbId = same[0].id;
      else candidates = results.slice(0, MAX_CANDIDATES).map(toCandidate);
    }

    if (igdbId != null) {
      await db.query(
        sql(db, "UPDATE games SET igdb_id = ?, igdb_match = 'auto', igdb_candidates = NULL WHERE id = ?"),
        [igdbId, game.id]
      );
      counts.auto += 1;
    } else {
      await db.query(
        sql(db, "UPDATE games SET igdb_match = 'unresolved', igdb_candidates = ? WHERE id = ?"),
        [JSON.stringify(candidates), game.id]
      );
      counts.unresolved += 1;
    }
  }
  return counts;
}

async function resolvePending(db, igdb, now) {
  const { rows } = await db.query(
    `SELECT DISTINCT g.igdb_id
     FROM games g LEFT JOIN igdb_resolution r ON r.igdb_id = g.igdb_id
     WHERE g.igdb_id IS NOT NULL
       AND (g.igdb_match IS NULL OR g.igdb_match NOT IN ('none', 'unresolved'))
       AND r.igdb_id IS NULL`
  );
  const pending = rows.map((r) => Number(r.igdb_id));
  if (pending.length === 0) return 0;

  const byId = new Map((await igdb.gamesByIds(pending)).map((g) => [g.id, g]));
  const missingParents = [...new Set(
    [...byId.values()].map(canonicalId).filter((id) => !byId.has(id))
  )];
  if (missingParents.length > 0) {
    for (const g of await igdb.gamesByIds(missingParents)) byId.set(g.id, g);
  }

  const resolvedAt = now.toISOString();
  let resolved = 0;
  for (const id of pending) {
    const game = byId.get(id);
    if (!game) continue;
    const canonical = byId.get(canonicalId(game));
    if (!canonical) continue;
    const saga = largestCollection(canonical.collections);

    await db.query(
      sql(db, isSqlite(db)
        ? 'INSERT OR REPLACE INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id, resolved_at) VALUES (?, ?, ?, ?)'
        : `INSERT INTO igdb_resolution (igdb_id, canonical_igdb_id, saga_id, resolved_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (igdb_id) DO UPDATE SET canonical_igdb_id = EXCLUDED.canonical_igdb_id,
             saga_id = EXCLUDED.saga_id, resolved_at = EXCLUDED.resolved_at`),
      [id, canonical.id, saga?.id ?? null, resolvedAt]
    );
    if (saga) {
      await db.query(
        sql(db, isSqlite(db)
          ? 'INSERT OR IGNORE INTO sagas (id, name, refreshed_at) VALUES (?, ?, NULL)'
          : 'INSERT INTO sagas (id, name, refreshed_at) VALUES (?, ?, NULL) ON CONFLICT (id) DO NOTHING'),
        [saga.id, saga.name]
      );
    }
    resolved += 1;
  }
  return resolved;
}

function versionsOf(game) {
  const best = new Map();
  const add = (source, year) => {
    for (const label of platformNames(source)) {
      const prev = best.get(label);
      if (!best.has(label) || (year != null && (prev == null || year > prev))) best.set(label, year);
    }
  };
  add(game, releaseYear(game.first_release_date));
  for (const v of [...(game.ports ?? []), ...(game.remasters ?? [])]) {
    add(v, releaseYear(v.first_release_date));
  }
  return [...best.entries()]
    .map(([label, year]) => ({ label, year }))
    .sort((a, b) => (a.year === null) - (b.year === null) || a.year - b.year || a.label.localeCompare(b.label));
}

async function refreshSaga(db, igdb, sagaId, now) {
  const members = await igdb.collectionMembers(sagaId);
  const games = members.filter(
    (g) => SAGA_GAME_TYPES.includes(g.game_type) && largestCollection(g.collections)?.id === sagaId
  );
  const upsert = isSqlite(db)
    ? `INSERT OR REPLACE INTO saga_games (igdb_id, saga_id, name, release_year, game_type, cover_url, versions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    : `INSERT INTO saga_games (igdb_id, saga_id, name, release_year, game_type, cover_url, versions)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (igdb_id) DO UPDATE SET saga_id = EXCLUDED.saga_id, name = EXCLUDED.name,
         release_year = EXCLUDED.release_year, game_type = EXCLUDED.game_type,
         cover_url = EXCLUDED.cover_url, versions = EXCLUDED.versions`;

  await db.transaction(async (tx) => {
    await tx.query(sql(db, 'DELETE FROM saga_games WHERE saga_id = ?'), [sagaId]);
    for (const g of games) {
      await tx.query(sql(db, upsert), [
        g.id,
        sagaId,
        g.name,
        releaseYear(g.first_release_date),
        g.game_type,
        coverUrl(g.cover),
        JSON.stringify(versionsOf(g)),
      ]);
    }
    await tx.query(sql(db, 'UPDATE sagas SET refreshed_at = ? WHERE id = ?'), [now.toISOString(), sagaId]);
  });
}

export async function syncSagas(db, igdb, { now = new Date(), maxAgeDays = 7, onlySagaId = null } = {}) {
  const resolved = await resolvePending(db, igdb, now);

  const { rows: due } = onlySagaId != null
    ? await db.query(sql(db, 'SELECT id FROM sagas WHERE id = ?'), [onlySagaId])
    : await db.query(
      sql(db, 'SELECT id FROM sagas WHERE refreshed_at IS NULL OR refreshed_at < ?'),
      [new Date(now.getTime() - maxAgeDays * DAY_MS).toISOString()]
    );

  for (const { id } of due) await refreshSaga(db, igdb, Number(id), now);
  return { resolved, refreshed: due.length };
}

export async function getStatusByCanonical(db) {
  const { rows } = await db.query(
    `SELECT r.canonical_igdb_id, g.completed
     FROM games g JOIN igdb_resolution r ON r.igdb_id = g.igdb_id
     WHERE g.igdb_match IS NULL OR g.igdb_match <> 'none'`
  );
  const status = new Map();
  for (const row of rows) {
    const id = Number(row.canonical_igdb_id);
    const s = statusOf(row);
    status.set(id, status.has(id) ? mergeStatus(status.get(id), s) : s);
  }
  return status;
}

export async function runSagaJobs(db, igdb, logger) {
  try {
    const backfill = await backfillIgdbIds(db, igdb);
    const sync = await syncSagas(db, igdb);
    logger.info({ backfill, sync }, 'Saga jobs finished');
  } catch (err) {
    logger.error({ err }, 'Saga jobs failed');
  }
}
