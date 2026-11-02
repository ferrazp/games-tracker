// Lógica pura de sagas (sin I/O): agrupación, estados y helpers de presentación.

// Tipos de IGDB que cuentan como juego propio de una saga: main game (0) y remake (8).
export const SAGA_GAME_TYPES = [0, 8];

const idOf = (v) => (v && typeof v === 'object' ? v.id : v);

export function largestCollection(collections) {
  if (!collections || collections.length === 0) return null;
  const best = collections.reduce((a, b) => {
    const sa = a.games?.length ?? 0;
    const sb = b.games?.length ?? 0;
    if (sb !== sa) return sb > sa ? b : a;
    return b.id < a.id ? b : a;
  });
  return { id: best.id, name: best.name };
}

export function canonicalId(game) {
  if (SAGA_GAME_TYPES.includes(game.game_type)) return game.id;
  return idOf(game.version_parent) ?? idOf(game.parent_game) ?? game.id;
}

export function statusOf(row) {
  return row.completed ? 'completed' : 'pending';
}

export function mergeStatus(a, b) {
  return a === 'completed' || b === 'completed' ? 'completed' : 'pending';
}

export function releaseYear(unixSeconds) {
  if (unixSeconds == null) return null;
  return new Date(unixSeconds * 1000).getUTCFullYear();
}

export function buildSagaDetail(saga, sagaGames, statusByCanonical) {
  const counts = { completed: 0, pending: 0, missing: 0, total: sagaGames.length };
  const byYear = new Map();
  for (const g of sagaGames) {
    const status = statusByCanonical.get(g.igdb_id) ?? 'missing';
    counts[status] += 1;
    const year = g.release_year ?? null;
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push({
      igdb_id: g.igdb_id,
      name: g.name,
      release_year: year,
      cover_url: g.cover_url ?? null,
      status,
    });
  }
  const groups = [...byYear.entries()]
    .sort(([a], [b]) => (a === null) - (b === null) || a - b)
    .map(([year, games]) => ({
      year,
      games: games.sort((x, y) => x.name.localeCompare(y.name)),
    }));
  return { id: saga.id, name: saga.name, counts, groups };
}

export function countsLabel({ completed, pending, missing, total }) {
  const c = `${completed} ${completed === 1 ? 'completado' : 'completados'}`;
  const p = `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`;
  return `${c} · ${p} · te faltan ${missing} de ${total}`;
}

export function suggestedVersion(versions) {
  if (!versions || versions.length === 0) return null;
  let best = null;
  for (const v of versions) {
    if (v.year != null && (best === null || v.year > best.year)) best = v;
  }
  return (best ?? versions[0]).label;
}

export function searchLinks(title) {
  const q = encodeURIComponent(title);
  return [
    { label: 'Steam', url: `https://store.steampowered.com/search/?term=${q}` },
    { label: 'PlayStation Store', url: `https://store.playstation.com/search/${q}` },
    { label: 'Nintendo eShop', url: `https://www.nintendo.com/search/#q=${q}` },
    { label: 'Xbox', url: `https://www.xbox.com/search?q=${q}` },
    { label: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent('dónde jugar ' + title)}` },
  ];
}

export function pickCatalogMatch(rows, title, consoleName) {
  const norm = (s) => String(s ?? '').trim().toLowerCase();
  const same = rows.filter((r) => norm(r.title) === norm(title));
  if (same.length === 0) return null;
  if (same.length === 1) return same[0].igdb_id;
  const onConsole = same.filter((r) => consoleName != null && norm(r.console_name) === norm(consoleName));
  return onConsole.length === 1 ? onConsole[0].igdb_id : null;
}
