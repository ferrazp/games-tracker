import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import LinkPanel from './LinkPanel';

const getHeaders = () => ({ 'Content-Type': 'application/json' });

const g = (igdb_id, name, release_year, extra = {}) => ({
  igdb_id, name, release_year, cover_url: null, status: 'missing', registered: false, link: null, ...extra,
});

const ff3d = g(393, 'Final Fantasy III', 2006, { status: 'completed', registered: true });
const ff3 = g(77234, 'Final Fantasy III', 1990);
const ff6us = g(426, 'Final Fantasy III', 1994);
const ff5 = g(415, 'Final Fantasy V', 1992);
const ff4 = g(414, 'Final Fantasy IV', 1991);

const detailWith = (games) => ({
  id: 39, name: 'Final Fantasy', counts: {}, archived: [],
  groups: [{ year: null, games }],
});

function mockFetch(body, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const renderPanel = (game, games, props = {}) => render(
  <LinkPanel game={game} detail={detailWith(games)} getHeaders={getHeaders}
    onClose={() => {}} onSaved={() => {}} {...props} />
);

const optionNames = () => screen.getAllByRole('checkbox').map((c) => c.closest('li').textContent);

test('sugiere primero las versiones con el mismo nombre, con su año', () => {
  renderPanel(ff3d, [ff4, ff5, ff3, ff6us, ff3d]);
  const names = optionNames();
  expect(names[0]).toMatch(/Final Fantasy III.*1990/);
  expect(names[1]).toMatch(/Final Fantasy III.*1994/);
  expect(names.slice(2).join()).toMatch(/Final Fantasy IV/);
  expect(names.join()).not.toMatch(/2006/);
});

test('el buscador filtra las versiones', async () => {
  const user = userEvent.setup();
  renderPanel(ff3d, [ff4, ff5, ff3, ff3d]);
  await user.type(screen.getByRole('searchbox', { name: 'Buscar en la saga' }), 'fantasy v');
  expect(optionNames()).toEqual([expect.stringMatching(/Final Fantasy V/)]);
});

test('guarda el grupo con el registrado como principal por defecto', async () => {
  const saved = { id: 39 };
  mockFetch(saved);
  const onSaved = vi.fn();
  const user = userEvent.setup();
  renderPanel(ff3, [ff3, ff3d, ff5], { onSaved });

  const save = screen.getByRole('button', { name: 'Guardar' });
  expect(save).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: /Final Fantasy III · 2006/ }));
  expect(screen.getByRole('radio', { name: 'Principal: Final Fantasy III · 2006' })).toBeChecked();
  await user.click(save);

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toMatch(/\/sagas\/39\/links$/);
  expect(options.method).toBe('PUT');
  expect(JSON.parse(options.body)).toEqual({ main_igdb_id: 393, igdb_ids: [77234] });
  expect(onSaved).toHaveBeenCalledWith(saved);
});

test('se puede elegir otra versión como principal', async () => {
  mockFetch({ id: 39 });
  const user = userEvent.setup();
  renderPanel(ff3d, [ff3, ff3d]);
  await user.click(screen.getByRole('checkbox', { name: /Final Fantasy III · 1990/ }));
  await user.click(screen.getByRole('radio', { name: 'Principal: Final Fantasy III · 1990' }));
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ main_igdb_id: 77234, igdb_ids: [393] });
});

test('un juego ya unido abre con su grupo marcado y se puede separar', async () => {
  const link = { main_igdb_id: 393, main_name: 'Final Fantasy III', main_year: 2006 };
  const main = { ...ff3d, link: { ...link, is_main: true } };
  const other = { ...ff3, status: 'completed', link: { ...link, is_main: false } };
  mockFetch({ id: 39 });
  const onSaved = vi.fn();
  const user = userEvent.setup();
  renderPanel(other, [main, other, ff5], { onSaved });

  expect(screen.getByRole('checkbox', { name: /Final Fantasy III · 2006/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Principal: Final Fantasy III · 2006' })).toBeChecked();
  await user.click(screen.getByRole('button', { name: 'Separar' }));
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toMatch(/\/sagas\/39\/links\/393$/);
  expect(options.method).toBe('DELETE');
  expect(onSaved).toHaveBeenCalled();
});

test('si falla muestra el error del backend', async () => {
  mockFetch({ error: 'Todas las versiones tienen que ser de esta saga' }, 400);
  const user = userEvent.setup();
  renderPanel(ff3d, [ff3, ff3d]);
  await user.click(screen.getByRole('checkbox', { name: /Final Fantasy III · 1990/ }));
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByText('Todas las versiones tienen que ser de esta saga')).toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' })).toBeEnabled();
});
