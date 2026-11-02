import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SESSION_EXPIRED_EVENT } from '../../api';
import UnresolvedGames from './UnresolvedGames';

const getHeaders = () => ({ 'Content-Type': 'application/json' });

const cand = (igdb_id, name, year, platforms, cover_url = null) => ({ igdb_id, name, year, platforms, cover_url });

const game = (id, title, candidates) => ({ id, title, console_name: 'PS2', candidates });

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// GET /sagas/unresolved devuelve `list`; el PUT lo resuelve `put(url, options)`.
function mockApi(list, put = () => res(200, { ok: true })) {
  global.fetch = vi.fn((url, options = {}) => {
    if (options.method === 'PUT') return Promise.resolve(put(url, options));
    return Promise.resolve(res(200, list));
  });
}

const puts = () => global.fetch.mock.calls.filter(([, o]) => o && o.method === 'PUT');

afterEach(() => {
  vi.restoreAllMocks();
});

test('muestra título, consola y un botón por candidato con año y plataformas', async () => {
  mockApi([game(7, 'Tales of Symphonia', [
    cand(421, 'Tales of Symphonia', 2003, ['GameCube', 'PS3'], 'https://x/c.jpg'),
    cand(422, 'Tales of Symphonia: Dawn of the New World', null, ['Wii']),
  ])]);
  render(<UnresolvedGames getHeaders={getHeaders} onDone={() => {}} />);

  expect(await screen.findByText('Tales of Symphonia', { selector: 'h3' })).toBeInTheDocument();
  expect(screen.getByText('PS2')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Tales of Symphonia \(2003\) · GameCube, PS3/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Dawn of the New World/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'No es de ninguna saga' })).toBeInTheDocument();
});

test('elegir un candidato manda PUT /games/7/igdb con el igdb_id', async () => {
  mockApi([game(7, 'Tales', [cand(421, 'Tales of Symphonia', 2003, ['GameCube'])]), game(8, 'Otro', [])]);
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={() => {}} />);

  await user.click(await screen.findByRole('button', { name: /Tales of Symphonia \(2003\)/ }));

  const [url, options] = puts()[0];
  expect(url).toMatch(/\/games\/7\/igdb$/);
  expect(JSON.parse(options.body)).toEqual({ igdb_id: 421 });
  expect(screen.queryByText('Tales', { selector: 'h3' })).not.toBeInTheDocument();
  expect(screen.getByText('Otro', { selector: 'h3' })).toBeInTheDocument();
});

test('"No es de ninguna saga" manda igdb_id null', async () => {
  mockApi([game(7, 'Tales', []), game(8, 'Otro', [])]);
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={() => {}} />);

  await user.click((await screen.findAllByRole('button', { name: 'No es de ninguna saga' }))[0]);

  const [url, options] = puts()[0];
  expect(url).toMatch(/\/games\/7\/igdb$/);
  expect(JSON.parse(options.body)).toEqual({ igdb_id: null });
});

test('al resolver el último juego llama onDone', async () => {
  mockApi([game(7, 'Tales', [])]);
  const onDone = vi.fn();
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={onDone} />);

  await user.click(await screen.findByRole('button', { name: 'No es de ninguna saga' }));
  await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
});

test('con la lista vacía avisa y "Volver" llama onDone', async () => {
  mockApi([]);
  const onDone = vi.fn();
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={onDone} />);

  expect(await screen.findByText('No hay juegos sin identificar.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Volver' }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('"Volver" funciona aunque queden juegos sin resolver', async () => {
  mockApi([game(7, 'Tales', [])]);
  const onDone = vi.fn();
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={onDone} />);

  await screen.findByText('Tales', { selector: 'h3' });
  await user.click(screen.getByRole('button', { name: 'Volver' }));
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('un error del PUT se muestra junto al juego y no lo saca de la lista', async () => {
  mockApi([game(7, 'Tales', [])], () => res(404, { error: 'Game not found' }));
  const onDone = vi.fn();
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={onDone} />);

  await user.click(await screen.findByRole('button', { name: 'No es de ninguna saga' }));

  expect(await screen.findByText('Game not found')).toBeInTheDocument();
  expect(screen.getByText('Tales', { selector: 'h3' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'No es de ninguna saga' })).toBeEnabled();
  expect(onDone).not.toHaveBeenCalled();
});

test('mientras se envía el PUT deshabilita los botones de ese juego', async () => {
  let release;
  global.fetch = vi.fn((url, options = {}) => (options.method === 'PUT'
    ? new Promise((r) => { release = () => r(res(200, { ok: true })); })
    : Promise.resolve(res(200, [game(7, 'Tales', [cand(421, 'Tales of Symphonia', 2003, [])]), game(8, 'Otro', [])]))));
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={() => {}} />);

  await user.click((await screen.findAllByRole('button', { name: 'No es de ninguna saga' }))[0]);

  const buttons = screen.getAllByRole('button', { name: /No es de ninguna saga|Tales of Symphonia/ });
  expect(buttons.filter((b) => b.disabled)).toHaveLength(2);
  expect(buttons.filter((b) => !b.disabled)).toHaveLength(1); // el del otro juego
  release();
  await vi.waitFor(() => expect(screen.queryByText('Tales', { selector: 'h3' })).not.toBeInTheDocument());
});

test('un 401 al elegir avisa a la app y no muestra alert()', async () => {
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const expired = vi.fn();
  window.addEventListener(SESSION_EXPIRED_EVENT, expired);
  mockApi([game(7, 'Tales', [])], () => res(401, { error: 'Invalid or expired token' }));
  const user = userEvent.setup();
  render(<UnresolvedGames getHeaders={getHeaders} onDone={() => {}} />);

  await user.click(await screen.findByRole('button', { name: 'No es de ninguna saga' }));

  await vi.waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
  window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(screen.queryByText('Invalid or expired token')).not.toBeInTheDocument();
});
