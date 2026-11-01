import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PostgreSQLClient, SQLiteClient } from '../../db/database.js';

function fakePool() {
  const log = [];
  let released = 0;
  const conn = {
    query: async (sql, params) => { log.push(sql); if (sql === 'FAIL') throw new Error('boom'); return { rows: [], params }; },
    release: () => { released++; },
  };
  return {
    log,
    get released() { return released; },
    connect: async () => conn,
    query: async () => { throw new Error('pool.query no debe usarse dentro de la transacción'); },
  };
}

describe('PostgreSQLClient.transaction', () => {
  it('ejecuta BEGIN, las queries y COMMIT sobre la misma conexión y la libera', async () => {
    const client = new PostgreSQLClient();
    client.pool = fakePool();
    const result = await client.transaction(async (tx) => {
      await tx.query('INSERT 1');
      await tx.query('INSERT 2');
      return 'ok';
    });
    assert.equal(result, 'ok');
    assert.deepEqual(client.pool.log, ['BEGIN', 'INSERT 1', 'INSERT 2', 'COMMIT']);
    assert.equal(client.pool.released, 1);
  });

  it('hace ROLLBACK, libera la conexión y propaga el error', async () => {
    const client = new PostgreSQLClient();
    client.pool = fakePool();
    await assert.rejects(client.transaction(async (tx) => { await tx.query('FAIL'); }), /boom/);
    assert.deepEqual(client.pool.log, ['BEGIN', 'FAIL', 'ROLLBACK']);
    assert.equal(client.pool.released, 1);
  });
});

describe('SQLiteClient.transaction', () => {
  async function newClient() {
    process.env.SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'gt-tx-')), 'tx.db');
    const client = new SQLiteClient();
    await client.connect();
    await client.query('CREATE TABLE t (v INTEGER)');
    return client;
  }

  it('confirma los cambios cuando fn termina bien', async () => {
    const client = await newClient();
    await client.transaction(async (tx) => { await tx.query('INSERT INTO t (v) VALUES (1)'); });
    const { rows } = await client.query('SELECT COUNT(*) AS n FROM t');
    assert.equal(rows[0].n, 1);
    await client.close();
  });

  it('descarta los cambios cuando fn falla', async () => {
    const client = await newClient();
    await assert.rejects(client.transaction(async (tx) => {
      await tx.query('INSERT INTO t (v) VALUES (1)');
      throw new Error('boom');
    }), /boom/);
    const { rows } = await client.query('SELECT COUNT(*) AS n FROM t');
    assert.equal(rows[0].n, 0);
    await client.close();
  });

  it('serializa transacciones concurrentes sin error de transacción anidada', async () => {
    const client = await newClient();
    await Promise.all([1, 2, 3].map(v => client.transaction(async (tx) => {
      await tx.query('INSERT INTO t (v) VALUES (?)', [v]);
    })));
    const { rows } = await client.query('SELECT COUNT(*) AS n FROM t');
    assert.equal(rows[0].n, 3);
    await client.close();
  });
});
