import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import request from 'supertest';

const tmpDir = mkdtempSync(join(tmpdir(), 'games-tracker-test-'));
const dbPath = join(tmpDir, 'test.db');

process.env.SQLITE_PATH = dbPath;
process.env.NODE_ENV = 'test';

const { app } = await import('../server-unified.js');
const { initializeDatabase, closeDatabase } = await import('../db/database.js');

let testConsoleId;
let authToken;

before(async () => {
  await initializeDatabase();
  const db = (await import('../db/database.js')).getDatabase();
  const result = await db.query("INSERT INTO consoles (name, launch_year) VALUES ('Test Console', 2000)");
  testConsoleId = result.lastID;

  const catalogEntries = [
    'Test Game', 'Updated Game', 'Orphan Game', 'Time Travel Game',
    'Bad Console Game', 'String Console Game', 'Ghost', 'Bad'
  ];
  for (let i = 0; i < catalogEntries.length; i++) {
    await db.query(
      "INSERT INTO game_catalog (igdb_id, title, console_name, release_date) VALUES (?, ?, '', 2020)",
      [i + 999, catalogEntries[i]]
    );
  }

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ username: 'admin', password: '1234' });
  authToken = loginRes.body.token;
});

after(async () => {
  await closeDatabase();
  rmSync(tmpDir, { recursive: true, force: true });
});

const auth = () => `Bearer ${authToken}`;

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });
});

describe('Consoles', () => {
  it('GET /consoles returns list', async () => {
    const res = await request(app).get('/consoles');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.consoles));
  });

  it('POST /consoles creates a console (201)', async () => {
    const res = await request(app)
      .post('/consoles')
      .set('Authorization', auth())
      .send({ name: 'New Console' });
    assert.equal(res.status, 201);
    assert.equal(res.body.console.name, 'New Console');
    assert.ok(res.body.console.id);
  });

  it('POST /consoles returns 400 on duplicate', async () => {
    const res = await request(app)
      .post('/consoles')
      .set('Authorization', auth())
      .send({ name: 'Test Console' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });
});

describe('Games CRUD', () => {
  let gameId;

  it('POST /games creates a game (201) with console_name', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Test Game', console_id: testConsoleId, year_played: 2020, completed: true });
    assert.equal(res.status, 201);
    assert.ok(res.body.game);
    assert.equal(res.body.game.title, 'Test Game');
    assert.equal(res.body.game.console_name, 'Test Console');
    assert.equal(res.body.game.console_id, testConsoleId);
    assert.equal(res.body.game.year_played, 2020);
    assert.ok(res.body.game.completed === true || res.body.game.completed === 1);
    gameId = res.body.game.id;
  });

  it('GET /games returns list with games and pagination', async () => {
    const res = await request(app).get('/games');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.games));
    assert.ok(res.body.games.length >= 1);
    assert.equal(typeof res.body.total, 'number');
    assert.equal(typeof res.body.limit, 'number');
    assert.equal(typeof res.body.offset, 'number');
  });

  it('GET /games supports pagination (limit, offset)', async () => {
    const res = await request(app).get('/games?limit=1&offset=0');
    assert.equal(res.status, 200);
    assert.ok(res.body.games.length <= 1);
    assert.equal(res.body.limit, 1);
    assert.equal(res.body.offset, 0);
    assert.ok(res.body.total >= 1);
  });

  it('GET /games filters by q param', async () => {
    const res = await request(app).get('/games?q=Test');
    assert.equal(res.status, 200);
    assert.ok(res.body.games.length >= 1);
    assert.ok(res.body.games.every(g => g.title.includes('Test')));
  });

  it('GET /games enforces max limit of 100', async () => {
    const res = await request(app).get('/games?limit=999');
    assert.equal(res.status, 200);
    assert.equal(res.body.limit, 100);
  });

  it('GET /games/:id returns game', async () => {
    const res = await request(app).get(`/games/${gameId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.game.title, 'Test Game');
  });

  it('GET /games/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/games/99999');
    assert.equal(res.status, 404);
  });

  it('PUT /games/:id updates game with updated_at change', async () => {
    await new Promise(r => setTimeout(r, 1200));
    const res = await request(app)
      .put(`/games/${gameId}`)
      .set('Authorization', auth())
      .send({ title: 'Updated Game', console_id: testConsoleId, year_played: 2021, completed: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.game.title, 'Updated Game');
    assert.equal(res.body.game.year_played, 2021);
    assert.ok(res.body.game.completed === false || res.body.game.completed === 0);
    assert.notEqual(res.body.game.updated_at, res.body.game.created_at);
  });

  it('PUT /games/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/games/99999')
      .set('Authorization', auth())
      .send({ title: 'Ghost', console_id: testConsoleId });
    assert.equal(res.status, 404);
  });

  it('PUT /games/:id returns 400 for invalid id', async () => {
    const res = await request(app)
      .put('/games/abc')
      .set('Authorization', auth())
      .send({ title: 'Bad', console_id: testConsoleId });
    assert.equal(res.status, 400);
  });

  it('DELETE /games/:id deletes game', async () => {
    const res = await request(app).delete(`/games/${gameId}`).set('Authorization', auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.gameId, gameId);
  });

  it('DELETE /games/:id returns 404 for already deleted', async () => {
    const res = await request(app).delete(`/games/${gameId}`).set('Authorization', auth());
    assert.equal(res.status, 404);
  });

  it('DELETE /games/:id returns 400 for invalid id', async () => {
    const res = await request(app).delete('/games/abc').set('Authorization', auth());
    assert.equal(res.status, 400);
  });
});

describe('Validation', () => {
  it('POST /games returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ console_id: testConsoleId });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /games returns 400 when console_id does not exist', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Orphan Game', console_id: 99999 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /games returns 400 when year_played is out of range', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Time Travel Game', console_id: testConsoleId, year_played: 1800 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('year_played'));
  });

  it('POST /games returns 400 when console_id is not a positive integer', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Bad Console Game', console_id: -1 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console_id'));
  });

  it('POST /games returns 400 when console_id is a string', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'String Console Game', console_id: 'abc' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console_id'));
  });

  it('POST /games returns 400 when year_played is before console launch year', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Time Travel Game', console_id: testConsoleId, year_played: 1999 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console launch year'));
  });

  it('POST /games returns 400 when year_played is provided without console_id', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Time Travel Game', year_played: 2020 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console_id is required'));
  });

  it('POST /games returns 400 when year_completed < year_played', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Completed Before Played', console_id: testConsoleId, year_played: 2020, completed: true, year_completed: 2019 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('year_completed'));
  });

  it('POST /games returns 400 when month_completed < month_played in same year', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Month Mismatch', console_id: testConsoleId, year_played: 2020, month_played: 12, completed: true, year_completed: 2020, month_completed: 6 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('month_completed'));
  });

  it('POST /games accepts valid year_completed >= year_played', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Valid Completion', console_id: testConsoleId, year_played: 2020, month_played: 6, completed: true, year_completed: 2021, month_completed: 3 });
    assert.equal(res.status, 201);
  });

  it('POST /games accepts valid year_completed same year later month', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', auth())
      .send({ title: 'Same Year Later Month', console_id: testConsoleId, year_played: 2020, month_played: 3, completed: true, year_completed: 2020, month_completed: 6 });
    assert.equal(res.status, 201);
  });
});

describe('Search', () => {
  it('POST /search returns expected shape', async () => {
    const res = await request(app)
      .post('/search')
      .send({ query: 'mario' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.equal(res.body.source, 'local');
    assert.equal(typeof res.body.online_available, 'boolean');
  });

  it('POST /search returns 400 for short query', async () => {
    const res = await request(app)
      .post('/search')
      .send({ query: 'ab' });
    assert.equal(res.status, 400);
  });
});
