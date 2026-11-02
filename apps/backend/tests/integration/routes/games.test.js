import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth, getTestConsoleId } from '../helpers/setup.js';

describe('Games CRUD', () => {
  let gameId;

  it('POST /games creates a game (201) with console_name', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Test Game', console_id: getTestConsoleId(), year_played: 2020, completed: true });
    assert.equal(res.status, 201);
    assert.ok(res.body.game);
    assert.equal(res.body.game.title, 'Test Game');
    assert.equal(res.body.game.console_name, 'Test Console');
    assert.equal(res.body.game.console_id, getTestConsoleId());
    assert.equal(res.body.game.year_played, 2020);
    assert.ok(res.body.game.completed === true || res.body.game.completed === 1);
    gameId = res.body.game.id;
  });

  it('POST /games returns 201 with month_played only', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Month Only Game', console_id: getTestConsoleId(), month_played: 6 });
    assert.equal(res.status, 201);
  });

  it('POST /games returns 409 on duplicate title+console', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Test Game', console_id: getTestConsoleId() });
    assert.equal(res.status, 409);
    assert.ok(res.body.error.includes('already exists'));
  });

  it('POST /games returns 400 when year_played < release_year', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Before Release', console_id: getTestConsoleId(), year_played: 2002, release_year: 2005 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('release year'));
  });

  it('POST /games returns 401 without JWT', async () => {
    const res = await request(getApp())
      .post('/games')
      .send({ title: 'No Auth Game', console_id: getTestConsoleId() });
    assert.equal(res.status, 401);
  });

  it('GET /games returns list with games and pagination', async () => {
    const res = await request(getApp()).get('/games');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.games));
    assert.ok(res.body.games.length >= 1);
    assert.equal(typeof res.body.total, 'number');
    assert.equal(typeof res.body.limit, 'number');
    assert.equal(typeof res.body.offset, 'number');
  });

  it('GET /games supports pagination (limit, offset)', async () => {
    const res = await request(getApp()).get('/games?limit=1&offset=0');
    assert.equal(res.status, 200);
    assert.ok(res.body.games.length <= 1);
    assert.equal(res.body.limit, 1);
    assert.equal(res.body.offset, 0);
    assert.ok(res.body.total >= 1);
  });

  it('GET /games filters by q param', async () => {
    const res = await request(getApp()).get('/games?q=Test');
    assert.equal(res.status, 200);
    assert.ok(res.body.games.length >= 1);
    assert.ok(res.body.games.every(g => g.title.includes('Test')));
  });

  it('GET /games filters by console_id', async () => {
    const res = await request(getApp()).get(`/games?console_id=${getTestConsoleId()}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.games.every(g => g.console_id === getTestConsoleId()));
  });

  it('GET /games filters by completed', async () => {
    const res = await request(getApp()).get('/games?completed=true');
    assert.equal(res.status, 200);
    assert.ok(res.body.games.every(g => g.completed === true || g.completed === 1));
  });

  it('GET /games enforces max limit of 100', async () => {
    const res = await request(getApp()).get('/games?limit=999');
    assert.equal(res.status, 200);
    assert.equal(res.body.limit, 100);
  });

  it('GET /games/:id returns game', async () => {
    const res = await request(getApp()).get(`/games/${gameId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.game.title, 'Test Game');
  });

  it('GET /games/:id returns 404 for unknown id', async () => {
    const res = await request(getApp()).get('/games/99999');
    assert.equal(res.status, 404);
  });

  it('PUT /games/:id updates game with updated_at change', async () => {
    await new Promise(r => setTimeout(r, 1200));
    const res = await request(getApp())
      .put(`/games/${gameId}`)
      .set('Authorization', getAuth())
      .send({ title: 'Updated Game', console_id: getTestConsoleId(), year_played: 2021, completed: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.game.title, 'Updated Game');
    assert.equal(res.body.game.year_played, 2021);
    assert.ok(res.body.game.completed === false || res.body.game.completed === 0);
    assert.notEqual(res.body.game.updated_at, res.body.game.created_at);
  });

  it('PUT /games/:id returns 404 for unknown id', async () => {
    const res = await request(getApp())
      .put('/games/99999')
      .set('Authorization', getAuth())
      .send({ title: 'Ghost', console_id: getTestConsoleId() });
    assert.equal(res.status, 404);
  });

  it('PUT /games/:id returns 400 for invalid id', async () => {
    const res = await request(getApp())
      .put('/games/abc')
      .set('Authorization', getAuth())
      .send({ title: 'Bad', console_id: getTestConsoleId() });
    assert.equal(res.status, 400);
  });

  it('PUT /games/:id returns 400 when console_id does not exist', async () => {
    const createRes = await request(getApp())
      .post('/games').set('Authorization', getAuth())
      .send({ title: 'PUT No Console', console_id: getTestConsoleId(), year_played: 2020 });
    const id = createRes.body.game.id;
    const res = await request(getApp())
      .put(`/games/${id}`).set('Authorization', getAuth())
      .send({ title: 'PUT No Console', console_id: 99999, year_played: 2020 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('Console does not exist'));
  });

  it('PUT /games/:id returns 400 when year_played < release_year', async () => {
    const createRes = await request(getApp())
      .post('/games').set('Authorization', getAuth())
      .send({ title: 'PUT Before Release', console_id: getTestConsoleId(), year_played: 2020 });
    const id = createRes.body.game.id;
    const res = await request(getApp())
      .put(`/games/${id}`).set('Authorization', getAuth())
      .send({ title: 'PUT Before Release', console_id: getTestConsoleId(), year_played: 2002, release_year: 2005 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('release year'));
  });

  it('PUT /games/:id returns 400 when year_completed < year_played', async () => {
    const createRes = await request(getApp())
      .post('/games').set('Authorization', getAuth())
      .send({ title: 'PUT Bad Completion', console_id: getTestConsoleId(), year_played: 2020 });
    const id = createRes.body.game.id;
    const res = await request(getApp())
      .put(`/games/${id}`).set('Authorization', getAuth())
      .send({ title: 'PUT Bad Completion', console_id: getTestConsoleId(), year_played: 2020, completed: true, year_completed: 2019 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('year_completed'));
  });

  it('PUT /games/:id returns 400 when month_completed < month_played same year', async () => {
    const createRes = await request(getApp())
      .post('/games').set('Authorization', getAuth())
      .send({ title: 'PUT Bad Month', console_id: getTestConsoleId(), year_played: 2020 });
    const id = createRes.body.game.id;
    const res = await request(getApp())
      .put(`/games/${id}`).set('Authorization', getAuth())
      .send({ title: 'PUT Bad Month', console_id: getTestConsoleId(), year_played: 2020, month_played: 12, completed: true, year_completed: 2020, month_completed: 6 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('month_completed'));
  });

  it('PUT /games/:id returns 400 with missing title', async () => {
    const res = await request(getApp())
      .put(`/games/1`).set('Authorization', getAuth())
      .send({ console_id: getTestConsoleId() });
    assert.equal(res.status, 400);
  });

  it('PUT /games/:id returns 400 when year_played < console launch year', async () => {
    const createRes = await request(getApp())
      .post('/games').set('Authorization', getAuth())
      .send({ title: 'PUT Before Console', console_id: getTestConsoleId(), year_played: 2020 });
    const id = createRes.body.game.id;
    const res = await request(getApp())
      .put(`/games/${id}`).set('Authorization', getAuth())
      .send({ title: 'PUT Before Console', console_id: getTestConsoleId(), year_played: 1999 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('launch year'));
  });

  it('DELETE /games/:id deletes game', async () => {
    const res = await request(getApp()).delete(`/games/${gameId}`).set('Authorization', getAuth());
    assert.equal(res.status, 200);
    assert.equal(res.body.gameId, gameId);
  });

  it('DELETE /games/:id returns 404 for already deleted', async () => {
    const res = await request(getApp()).delete(`/games/${gameId}`).set('Authorization', getAuth());
    assert.equal(res.status, 404);
  });

  it('DELETE /games/:id returns 400 for invalid id', async () => {
    const res = await request(getApp()).delete('/games/abc').set('Authorization', getAuth());
    assert.equal(res.status, 400);
  });
});

describe('Validation', () => {
  it('POST /games returns 400 when title is missing', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ console_id: getTestConsoleId() });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /games returns 400 when console_id does not exist', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Orphan Game', console_id: 99999 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /games returns 400 when year_played is out of range', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Time Travel Game', console_id: getTestConsoleId(), year_played: 1800 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('year_played'));
  });

  it('POST /games returns 400 when console_id is not a positive integer', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Bad Console Game', console_id: -1 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console_id'));
  });

  it('POST /games returns 400 when console_id is a string', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'String Console Game', console_id: 'abc' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console_id'));
  });

  it('POST /games returns 400 when year_played is before console launch year', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Time Travel Game', console_id: getTestConsoleId(), year_played: 1999 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console launch year'));
  });

  it('POST /games returns 400 when year_played is provided without console_id', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Time Travel Game', year_played: 2020 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('console_id is required'));
  });

  it('POST /games returns 400 when year_completed < year_played', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Completed Before Played', console_id: getTestConsoleId(), year_played: 2020, completed: true, year_completed: 2019 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('year_completed'));
  });

  it('POST /games returns 400 when month_completed < month_played in same year', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Month Mismatch', console_id: getTestConsoleId(), year_played: 2020, month_played: 12, completed: true, year_completed: 2020, month_completed: 6 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('month_completed'));
  });

  it('POST /games accepts valid year_completed >= year_played', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Valid Completion', console_id: getTestConsoleId(), year_played: 2020, month_played: 6, completed: true, year_completed: 2021, month_completed: 3 });
    assert.equal(res.status, 201);
  });

  it('POST /games accepts valid year_completed same year later month', async () => {
    const res = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Same Year Later Month', console_id: getTestConsoleId(), year_played: 2020, month_played: 3, completed: true, year_completed: 2020, month_completed: 6 });
    assert.equal(res.status, 201);
  });
});
