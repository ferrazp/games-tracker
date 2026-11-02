import { getTwitchToken } from './twitch.js';
import { config } from '../config.js';

const IGDB_URL = 'https://api.igdb.com/v4';
const BATCH_SIZE = 500;

export const SAGA_GAME_FIELDS =
  'name,game_type,first_release_date,cover.url,platforms.name,collections.name,collections.games,version_parent,parent_game,ports.name,ports.platforms.name,ports.first_release_date,remasters.name,remasters.platforms.name,remasters.first_release_date';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createIgdbClient({
  fetchImpl = fetch,
  getToken = getTwitchToken,
  clientId = config.twitch.clientId,
  minIntervalMs = 260,
} = {}) {
  let queue = Promise.resolve();
  let lastStart = 0;

  async function send(endpoint, body) {
    const wait = lastStart + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();
    const token = await getToken();
    const response = await fetchImpl(`${IGDB_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`IGDB API error: ${response.status}`);
    }
    return response.json();
  }

  function query(endpoint, body) {
    const result = queue.then(() => send(endpoint, body));
    queue = result.catch(() => {});
    return result;
  }

  async function gamesByIds(ids) {
    const results = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const rows = await query(
        'games',
        `fields ${SAGA_GAME_FIELDS}; where id = (${batch.join(',')}); limit ${BATCH_SIZE};`
      );
      results.push(...rows);
    }
    return results;
  }

  function collectionMembers(collectionId) {
    return query(
      'games',
      `fields ${SAGA_GAME_FIELDS}; where collections = (${collectionId}); limit 500;`
    );
  }

  function search(title, platformIds) {
    const clean = String(title).replace(/"/g, '');
    const where = platformIds?.length ? ` where platforms = (${platformIds.join(',')});` : '';
    return query('games', `search "${clean}"; fields ${SAGA_GAME_FIELDS};${where} limit 10;`);
  }

  return { query, gamesByIds, collectionMembers, search };
}
