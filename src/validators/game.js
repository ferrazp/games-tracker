import { CURRENT_YEAR } from '../config.js';

export function validateGameData(data) {
  const { title, console_id, year_played, month_played, year_completed, month_completed, hours_played, release_year, image } = data;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { valid: false, error: 'Title is required and must be a string' };
  }

  if (console_id !== undefined && console_id !== null && console_id !== '') {
    const c = typeof console_id === 'number' ? console_id : parseInt(console_id, 10);
    if (isNaN(c) || !Number.isInteger(c) || c < 1) {
      return { valid: false, error: 'console_id must be a positive integer' };
    }
  }

  if (year_played !== undefined && year_played !== null && year_played !== '') {
    const y = typeof year_played === 'number' ? year_played : parseInt(year_played, 10);
    if (isNaN(y) || !Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR) {
      return { valid: false, error: `year_played must be an integer between 1950 and ${CURRENT_YEAR}` };
    }
    const hasConsole = console_id !== undefined && console_id !== null && console_id !== '';
    if (!hasConsole) {
      return { valid: false, error: 'console_id is required when year_played is provided' };
    }
  }

  if (month_played !== undefined && month_played !== null && month_played !== '') {
    const m = typeof month_played === 'number' ? month_played : parseInt(month_played, 10);
    if (isNaN(m) || !Number.isInteger(m) || m < 1 || m > 12) {
      return { valid: false, error: 'month_played must be an integer between 1 and 12' };
    }
  }

  if (year_completed !== undefined && year_completed !== null && year_completed !== '') {
    const y = typeof year_completed === 'number' ? year_completed : parseInt(year_completed, 10);
    if (isNaN(y) || !Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR) {
      return { valid: false, error: `year_completed must be an integer between 1950 and ${CURRENT_YEAR}` };
    }
  }

  if (month_completed !== undefined && month_completed !== null && month_completed !== '') {
    const m = typeof month_completed === 'number' ? month_completed : parseInt(month_completed, 10);
    if (isNaN(m) || !Number.isInteger(m) || m < 1 || m > 12) {
      return { valid: false, error: 'month_completed must be an integer between 1 and 12' };
    }
  }

  if (hours_played !== undefined && hours_played !== null && hours_played !== '') {
    const h = typeof hours_played === 'number' ? hours_played : parseFloat(hours_played);
    if (isNaN(h) || h < 0) {
      return { valid: false, error: 'hours_played must be a positive number' };
    }
  }

  if (image !== undefined && image !== null && image !== '') {
    if (typeof image !== 'string') {
      return { valid: false, error: 'image must be a string' };
    }
  }

  if (release_year !== undefined && release_year !== null && release_year !== '') {
    const y = typeof release_year === 'number' ? release_year : parseInt(release_year, 10);
    if (isNaN(y) || !Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR) {
      return { valid: false, error: `release_year must be an integer between 1950 and ${CURRENT_YEAR}` };
    }
  }

  return { valid: true };
}

export function parseGameData(data) {
  const rawConsoleId = data.console_id;
  const rawYear = data.year_played;
  const rawMonth = data.month_played;
  const rawYearCompleted = data.year_completed;
  const rawMonthCompleted = data.month_completed;
  const rawHours = data.hours_played;
  const rawReleaseYear = data.release_year;

  return {
    title: data.title.trim(),
    console_id: rawConsoleId !== undefined && rawConsoleId !== null && rawConsoleId !== ''
      ? parseInt(rawConsoleId, 10) : null,
    year_played: rawYear !== undefined && rawYear !== null && rawYear !== ''
      ? parseInt(rawYear, 10) : null,
    month_played: rawMonth !== undefined && rawMonth !== null && rawMonth !== ''
      ? parseInt(rawMonth, 10) : null,
    year_completed: rawYearCompleted !== undefined && rawYearCompleted !== null && rawYearCompleted !== ''
      ? parseInt(rawYearCompleted, 10) : null,
    month_completed: rawMonthCompleted !== undefined && rawMonthCompleted !== null && rawMonthCompleted !== ''
      ? parseInt(rawMonthCompleted, 10) : null,
    hours_played: rawHours !== undefined && rawHours !== null && rawHours !== ''
      ? parseFloat(rawHours) : null,
    completed: data.completed === true || data.completed === 'true',
    image: data.image || null,
    release_year: rawReleaseYear !== undefined && rawReleaseYear !== null && rawReleaseYear !== ''
      ? parseInt(rawReleaseYear, 10) : null
  };
}
