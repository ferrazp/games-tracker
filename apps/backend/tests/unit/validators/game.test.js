import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateGameData, parseGameData } from '../../../src/validators/game.js';
import { CURRENT_YEAR } from '../../../src/config.js';

describe('validateGameData', () => {
  it('returns valid for complete valid data', () => {
    const result = validateGameData({
      title: 'Super Mario',
      console_id: 1,
      year_played: 2020,
      month_played: 6,
      year_completed: 2020,
      month_completed: 8,
      hours_played: 40,
      completed: true,
      release_year: 1996,
      image: 'data:image/png;base64,abc'
    });
    assert.ok(result.valid);
  });

  it('rejects missing title', () => {
    assert.ok(!validateGameData({}).valid);
    assert.ok(!validateGameData({ title: '' }).valid);
    assert.ok(!validateGameData({ title: '   ' }).valid);
    assert.ok(!validateGameData({ title: 123 }).valid);
  });

  it('rejects non-positive console_id', () => {
    const r1 = validateGameData({ title: 'G', console_id: 0 });
    assert.ok(!r1.valid);
    assert.ok(r1.error.includes('console_id'));

    const r2 = validateGameData({ title: 'G', console_id: -1 });
    assert.ok(!r2.valid);

    const r3 = validateGameData({ title: 'G', console_id: 1.5 });
    assert.ok(!r3.valid);
  });

  it('accepts null console_id', () => {
    assert.ok(validateGameData({ title: 'G', console_id: null }).valid);
  });

  it('accepts empty string console_id', () => {
    assert.ok(validateGameData({ title: 'G', console_id: '' }).valid);
  });

  it('accepts undefined console_id', () => {
    assert.ok(validateGameData({ title: 'G' }).valid);
  });

  it('rejects year_played out of range', () => {
    const r1 = validateGameData({ title: 'G', console_id: 1, year_played: 1949 });
    assert.ok(!r1.valid);
    assert.ok(r1.error.includes('year_played'));

    const r2 = validateGameData({ title: 'G', console_id: 1, year_played: CURRENT_YEAR + 1 });
    assert.ok(!r2.valid);
    assert.ok(r2.error.includes('year_played'));
  });

  it('rejects year_played without console_id', () => {
    const r = validateGameData({ title: 'G', year_played: 2020 });
    assert.ok(!r.valid);
    assert.ok(r.error.includes('console_id is required'));
  });

  it('accepts null year_played without console_id', () => {
    assert.ok(validateGameData({ title: 'G', year_played: null }).valid);
  });

  it('rejects month_played out of range', () => {
    const r1 = validateGameData({ title: 'G', month_played: 0 });
    assert.ok(!r1.valid);
    assert.ok(r1.error.includes('month_played'));

    const r2 = validateGameData({ title: 'G', month_played: 13 });
    assert.ok(!r2.valid);
    assert.ok(r2.error.includes('month_played'));
  });

  it('rejects year_completed out of range', () => {
    const r = validateGameData({ title: 'G', year_completed: 1949 });
    assert.ok(!r.valid);
    assert.ok(r.error.includes('year_completed'));
  });

  it('rejects month_completed out of range', () => {
    const r = validateGameData({ title: 'G', month_completed: 0 });
    assert.ok(!r.valid);
    assert.ok(r.error.includes('month_completed'));
  });

  it('rejects negative hours_played', () => {
    const r = validateGameData({ title: 'G', hours_played: -1 });
    assert.ok(!r.valid);
    assert.ok(r.error.includes('hours_played'));
  });

  it('rejects non-string image', () => {
    const r = validateGameData({ title: 'G', image: 123 });
    assert.ok(!r.valid);
    assert.ok(r.error.includes('image'));
  });

  it('accepts null image', () => {
    assert.ok(validateGameData({ title: 'G', image: null }).valid);
  });

  it('accepts empty string image', () => {
    assert.ok(validateGameData({ title: 'G', image: '' }).valid);
  });

  it('rejects release_year out of range', () => {
    const r = validateGameData({ title: 'G', release_year: 1949 });
    assert.ok(!r.valid);
    assert.ok(r.error.includes('release_year'));
  });

  it('rejects release_year greater than current year', () => {
    const r = validateGameData({ title: 'G', release_year: CURRENT_YEAR + 10 });
    assert.ok(!r.valid);
    assert.ok(r.error.includes('release_year'));
  });

  it('accepts valid release_year', () => {
    assert.ok(validateGameData({ title: 'G', release_year: 2000 }).valid);
  });

  it('accepts null/empty/undefined optional fields', () => {
    assert.ok(validateGameData({
      title: 'G', console_id: null,
      year_played: null, month_played: null,
      year_completed: null, month_completed: null,
      hours_played: null, release_year: null, image: null
    }).valid);

    assert.ok(validateGameData({
      title: 'G', console_id: '',
      year_played: '', month_played: '',
      year_completed: '', month_completed: '',
      hours_played: '', release_year: '', image: ''
    }).valid);
  });
});

describe('parseGameData', () => {
  it('parses all fields correctly', () => {
    const result = parseGameData({
      title: '  Zelda  ',
      console_id: '5',
      year_played: '2020',
      month_played: '6',
      year_completed: '2021',
      month_completed: '3',
      hours_played: '40.5',
      completed: true,
      release_year: '1998',
      image: 'data:img/png;base64,xyz'
    });
    assert.equal(result.title, 'Zelda');
    assert.equal(result.console_id, 5);
    assert.equal(result.year_played, 2020);
    assert.equal(result.month_played, 6);
    assert.equal(result.year_completed, 2021);
    assert.equal(result.month_completed, 3);
    assert.equal(result.hours_played, 40.5);
    assert.equal(result.completed, true);
    assert.equal(result.release_year, 1998);
    assert.equal(result.image, 'data:img/png;base64,xyz');
  });

  it('parses numeric console_id correctly', () => {
    const r = parseGameData({ title: 'G', console_id: 3 });
    assert.equal(r.console_id, 3);
  });

  it('handles completed as string true', () => {
    const r = parseGameData({ title: 'G', completed: 'true' });
    assert.equal(r.completed, true);
  });

  it('handles completed as false', () => {
    const r = parseGameData({ title: 'G', completed: false });
    assert.equal(r.completed, false);
  });

  it('sets optional fields to null when undefined', () => {
    const r = parseGameData({ title: 'G' });
    assert.equal(r.console_id, null);
    assert.equal(r.year_played, null);
    assert.equal(r.month_played, null);
    assert.equal(r.year_completed, null);
    assert.equal(r.month_completed, null);
    assert.equal(r.hours_played, null);
    assert.equal(r.completed, false);
    assert.equal(r.image, null);
    assert.equal(r.release_year, null);
  });

  it('trims title whitespace', () => {
    const r = parseGameData({ title: '  Hello World  ' });
    assert.equal(r.title, 'Hello World');
  });
});
