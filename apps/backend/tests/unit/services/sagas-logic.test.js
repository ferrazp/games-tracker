import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAGA_GAME_TYPES,
  largestCollection,
  canonicalId,
  statusOf,
  mergeStatus,
  releaseYear,
  buildSagaDetail,
  countsLabel,
  suggestedVersion,
  searchLinks,
  pickCatalogMatch,
} from '../../../src/services/sagas-logic.js';

describe('sagas-logic', () => {
  it('SAGA_GAME_TYPES', () => {
    assert.deepEqual(SAGA_GAME_TYPES, [0, 8]);
  });

  describe('largestCollection', () => {
    it('elige la colección con más juegos', () => {
      const r = largestCollection([
        { id: 9007, name: 'Final Fantasy VII', games: [1, 2] },
        { id: 39, name: 'Final Fantasy', games: [1, 2, 3] },
      ]);
      assert.deepEqual(r, { id: 39, name: 'Final Fantasy' });
    });
    it('desempata por menor id', () => {
      const r = largestCollection([
        { id: 50, name: 'A', games: [1] },
        { id: 12, name: 'B', games: [1] },
      ]);
      assert.deepEqual(r, { id: 12, name: 'B' });
    });
    it('vacío o undefined → null', () => {
      assert.equal(largestCollection([]), null);
      assert.equal(largestCollection(undefined), null);
    });
  });

  describe('canonicalId', () => {
    it('un remake es él mismo', () => {
      assert.equal(canonicalId({ id: 11169, game_type: 8, parent_game: { id: 427 } }), 11169);
    });
    it('version_parent numérico', () => {
      assert.equal(canonicalId({ id: 21899, game_type: 9, version_parent: 418 }), 418);
    });
    it('parent_game como objeto', () => {
      assert.equal(canonicalId({ id: 14723, game_type: 2, parent_game: { id: 386 } }), 386);
    });
    it('sin padres es él mismo', () => {
      assert.equal(canonicalId({ id: 5, game_type: 11 }), 5);
    });
  });

  describe('estados', () => {
    it('statusOf', () => {
      assert.equal(statusOf({ completed: 0 }), 'pending');
      assert.equal(statusOf({ completed: 1 }), 'completed');
      assert.equal(statusOf({ completed: true }), 'completed');
    });
    it('mergeStatus: completed gana', () => {
      assert.equal(mergeStatus('pending', 'completed'), 'completed');
      assert.equal(mergeStatus('completed', 'pending'), 'completed');
      assert.equal(mergeStatus('pending', 'pending'), 'pending');
    });
  });

  describe('releaseYear', () => {
    it('año UTC', () => {
      assert.equal(releaseYear(946684800), 2000);
      assert.equal(releaseYear(946684799), 1999);
    });
    it('null/undefined → null', () => {
      assert.equal(releaseYear(null), null);
      assert.equal(releaseYear(undefined), null);
    });
  });

  describe('buildSagaDetail', () => {
    it('agrupa por año y cuenta', () => {
      const d = buildSagaDetail(
        { id: 39, name: 'Final Fantasy' },
        [
          { igdb_id: 421, name: 'Final Fantasy IX', release_year: 2000, cover_url: null },
          { igdb_id: 31551, name: 'Final Fantasy XVI', release_year: 2023, cover_url: null },
          { igdb_id: 7, name: 'Sin año', release_year: null, cover_url: null },
        ],
        new Map([[31551, 'completed']])
      );
      assert.deepEqual(d.counts, { completed: 1, pending: 0, missing: 2, total: 3 });
      assert.deepEqual(d.groups.map((g) => g.year), [2000, 2023, null]);
      assert.equal(d.groups[0].games[0].status, 'missing');
      assert.equal(d.groups[1].games[0].status, 'completed');
      assert.equal(d.id, 39);
    });
    it('ordena por nombre dentro del grupo', () => {
      const d = buildSagaDetail(
        { id: 1, name: 'S' },
        [
          { igdb_id: 2, name: 'B', release_year: 2000, cover_url: null },
          { igdb_id: 1, name: 'A', release_year: 2000, cover_url: null },
        ],
        new Map([[2, 'pending']])
      );
      assert.deepEqual(d.groups[0].games.map((g) => g.name), ['A', 'B']);
      assert.equal(d.counts.pending, 1);
    });
  });

  describe('countsLabel', () => {
    it('singular', () => {
      assert.equal(
        countsLabel({ completed: 1, pending: 1, missing: 84, total: 86 }),
        '1 completado · 1 pendiente · te faltan 84 de 86'
      );
    });
    it('plural', () => {
      assert.equal(
        countsLabel({ completed: 4, pending: 0, missing: 82, total: 86 }),
        '4 completados · 0 pendientes · te faltan 82 de 86'
      );
    });
  });

  describe('suggestedVersion', () => {
    it('mayor año', () => {
      assert.equal(
        suggestedVersion([{ label: 'PlayStation 1', year: 2000 }, { label: 'PlayStation 4', year: 2017 }]),
        'PlayStation 4'
      );
    });
    it('sin años → la primera; vacío → null', () => {
      assert.equal(suggestedVersion([{ label: 'A', year: null }, { label: 'B', year: null }]), 'A');
      assert.equal(suggestedVersion([]), null);
    });
  });

  describe('searchLinks', () => {
    it('arma los 5 links', () => {
      const links = searchLinks('Final Fantasy IX');
      assert.deepEqual(links.map((l) => l.label), ['Steam', 'PlayStation Store', 'Nintendo eShop', 'Xbox', 'Google']);
      assert.deepEqual(links.map((l) => l.url), [
        'https://store.steampowered.com/search/?term=Final%20Fantasy%20IX',
        'https://store.playstation.com/search/Final%20Fantasy%20IX',
        'https://www.nintendo.com/search/#q=Final%20Fantasy%20IX',
        'https://www.xbox.com/search?q=Final%20Fantasy%20IX',
        'https://www.google.com/search?q=d%C3%B3nde%20jugar%20Final%20Fantasy%20IX',
      ]);
    });
  });

  describe('pickCatalogMatch', () => {
    const rows = [
      { igdb_id: 427, title: 'Final Fantasy VII', console_name: 'PlayStation 1' },
      { igdb_id: 207021, title: 'Final Fantasy VII', console_name: 'PC' },
    ];
    it('desambigua por consola', () => {
      assert.equal(pickCatalogMatch(rows, 'final fantasy vii', 'PC'), 207021);
    });
    it('ambiguo → null', () => {
      assert.equal(pickCatalogMatch(rows, 'final fantasy vii', 'Nintendo Switch'), null);
    });
    it('una sola fila → su id', () => {
      assert.equal(pickCatalogMatch([rows[0]], ' Final Fantasy VII ', 'PC'), 427);
    });
    it('sin coincidencias → null', () => {
      assert.equal(pickCatalogMatch(rows, 'Otro', 'PC'), null);
    });
  });
});
