import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { getApp, getAuth, getTestConsoleId } from '../helpers/setup.js';

describe('PUT /games/:id conserva release_year', () => {
  it('no borra release_year si el body no lo incluye', async () => {
    const created = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Release Year Keeper', console_id: getTestConsoleId(), year_played: 2010, release_year: 2005 });
    assert.equal(created.status, 201);
    const id = created.body.game.id;

    const updated = await request(getApp())
      .put(`/games/${id}`)
      .set('Authorization', getAuth())
      .send({ title: 'Release Year Keeper', console_id: getTestConsoleId(), year_played: 2011, completed: false });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.game.release_year, 2005);
    assert.equal(updated.body.game.year_played, 2011);
  });

  it('valida year_played contra el release_year guardado', async () => {
    const created = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Release Year Validator', console_id: getTestConsoleId(), year_played: 2010, release_year: 2008 });
    const id = created.body.game.id;

    const res = await request(getApp())
      .put(`/games/${id}`)
      .set('Authorization', getAuth())
      .send({ title: 'Release Year Validator', console_id: getTestConsoleId(), year_played: 2006 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('release year'));
  });

  it('permite limpiar release_year explícitamente con null', async () => {
    const created = await request(getApp())
      .post('/games')
      .set('Authorization', getAuth())
      .send({ title: 'Release Year Clear', console_id: getTestConsoleId(), release_year: 2001 });
    const id = created.body.game.id;

    const res = await request(getApp())
      .put(`/games/${id}`)
      .set('Authorization', getAuth())
      .send({ title: 'Release Year Clear', console_id: getTestConsoleId(), release_year: null });
    assert.equal(res.status, 200);
    assert.equal(res.body.game.release_year, null);
  });
});
