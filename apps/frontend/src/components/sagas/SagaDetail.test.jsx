import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SagaDetail from './SagaDetail';

const getHeaders = () => ({ 'Content-Type': 'application/json' });

const detail = {
  id: 39,
  name: 'Tales',
  counts: { completed: 1, pending: 1, missing: 1, total: 3 },
  groups: [
    { year: 2020, games: [
      { igdb_id: 1, name: 'Tales Uno', release_year: 2020, cover_url: 'https://x/1.jpg', status: 'completed' },
      { igdb_id: 2, name: 'Tales Dos', release_year: 2020, cover_url: null, status: 'pending' },
    ] },
    { year: null, games: [
      { igdb_id: 3, name: 'Tales Tres', release_year: null, cover_url: null, status: 'missing' },
    ] },
  ],
};

const suggest = {
  igdb_id: 3,
  name: 'Tales Tres',
  release_year: null,
  versions: [{ label: 'PS1', year: 2000 }, { label: 'PS4', year: 2017 }],
  suggested: 'PS4',
  links: [
    { label: 'Steam', url: 'https://store.steampowered.com/search/?term=Tales' },
    { label: 'Google', url: 'https://www.google.com/search?q=x' },
  ],
};

function mockFetch(routes) {
  global.fetch = vi.fn(async (url, options) => {
    const method = options?.method || 'GET';
    for (const [key, res] of Object.entries(routes)) {
      const [m, path] = key.split(' ');
      if (m === method && url.endsWith(path)) {
        const status = res.status ?? 200;
        return { ok: status < 400, status, json: async () => res.body };
      }
    }
    throw new Error(`sin mock para ${method} ${url}`);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

const renderDetail = (props = {}) =>
  render(<SagaDetail sagaId={39} onBack={() => {}} getHeaders={getHeaders} isAuthenticated={false} {...props} />);

test('agrupa por año con "Sin fecha" al final y marca el faltante', async () => {
  mockFetch({ 'GET /sagas/39': { body: detail } });
  renderDetail();

  expect(await screen.findByRole('button', { name: '← Tales' })).toBeInTheDocument();
  expect(screen.getByText('1 completado · 1 pendiente · te faltan 1 de 3')).toBeInTheDocument();

  const years = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(years).toEqual(['2020', 'Sin fecha']);

  const missing = screen.getByRole('button', { name: /Tales Tres/ });
  expect(missing).toHaveClass('missing');
  expect(missing).toHaveClass('saga-cover');
});

test('el filtro "Te faltan" deja solo el faltante', async () => {
  mockFetch({ 'GET /sagas/39': { body: detail } });
  const user = userEvent.setup();
  renderDetail();
  await screen.findByRole('button', { name: '← Tales' });

  await user.click(screen.getByRole('button', { name: 'Te faltan' }));
  expect(screen.getByText('Tales Tres')).toBeInTheDocument();
  expect(screen.queryByText('Tales Uno')).not.toBeInTheDocument();
  expect(screen.queryByText('Tales Dos')).not.toBeInTheDocument();
});

test('un filtro sin juegos muestra un texto en lugar de la grilla vacía', async () => {
  const allCompleted = {
    ...detail,
    counts: { completed: 1, pending: 0, missing: 0, total: 1 },
    groups: [{ year: 2020, games: [detail.groups[0].games[0]] }],
  };
  const noneCompleted = {
    ...detail,
    counts: { completed: 0, pending: 0, missing: 1, total: 1 },
    groups: [{ year: null, games: [detail.groups[1].games[0]] }],
  };
  const user = userEvent.setup();

  mockFetch({ 'GET /sagas/39': { body: allCompleted } });
  const { unmount } = renderDetail();
  await screen.findByRole('button', { name: '← Tales' });
  expect(screen.queryByText('No te falta ninguno.')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Te faltan' }));
  expect(screen.getByText('No te falta ninguno.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Pendientes' }));
  expect(screen.getByText('No tenés ninguno pendiente.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Completados' }));
  expect(screen.queryByText('Todavía no completaste ninguno.')).not.toBeInTheDocument();
  unmount();

  mockFetch({ 'GET /sagas/39': { body: noneCompleted } });
  renderDetail();
  await screen.findByRole('button', { name: '← Tales' });
  await user.click(screen.getByRole('button', { name: 'Completados' }));
  expect(screen.getByText('Todavía no completaste ninguno.')).toBeInTheDocument();
});

test('clic en un faltante abre el panel con versiones, sugerida y links', async () => {
  mockFetch({
    'GET /sagas/39': { body: detail },
    'GET /sagas/games/3/suggest': { body: suggest },
  });
  const user = userEvent.setup();
  renderDetail();

  await user.click(await screen.findByRole('button', { name: /Tales Tres/ }));
  expect(await screen.findByText('Versiones que conoce IGDB')).toBeInTheDocument();
  expect(screen.getByText('★ PS4 (2017) · sugerida')).toBeInTheDocument();
  expect(screen.getByText('PS1 (2000)')).toBeInTheDocument();
  const steam = screen.getByRole('link', { name: 'Steam' });
  expect(steam).toHaveAttribute('href', 'https://store.steampowered.com/search/?term=Tales');
  expect(steam).toHaveAttribute('target', '_blank');
  expect(steam).toHaveAttribute('rel', 'noopener noreferrer');

  await user.click(screen.getByRole('button', { name: 'Cerrar' }));
  expect(screen.queryByText('Versiones que conoce IGDB')).not.toBeInTheDocument();
});

test('sin sesión no hay botón "Actualizar saga"', async () => {
  mockFetch({ 'GET /sagas/39': { body: detail } });
  renderDetail({ isAuthenticated: false });
  await screen.findByRole('button', { name: '← Tales' });
  expect(screen.queryByRole('button', { name: 'Actualizar saga' })).not.toBeInTheDocument();
});

test('con sesión, "Actualizar saga" hace POST y un 503 muestra el error del backend', async () => {
  mockFetch({
    'GET /sagas/39': { body: detail },
    'POST /sagas/39/refresh': { status: 503, body: { error: 'Falta configurar las credenciales de IGDB' } },
  });
  const user = userEvent.setup();
  renderDetail({ isAuthenticated: true });

  await user.click(await screen.findByRole('button', { name: 'Actualizar saga' }));
  expect(await screen.findByText('Falta configurar las credenciales de IGDB')).toBeInTheDocument();
  const post = global.fetch.mock.calls.find(([, o]) => o?.method === 'POST');
  expect(post[0]).toMatch(/\/sagas\/39\/refresh$/);
});

test('un refresh exitoso reemplaza el detalle', async () => {
  const updated = { ...detail, name: 'Tales HD', counts: { completed: 1, pending: 1, missing: 0, total: 2 }, groups: [detail.groups[0]] };
  mockFetch({
    'GET /sagas/39': { body: detail },
    'POST /sagas/39/refresh': { body: updated },
  });
  const user = userEvent.setup();
  renderDetail({ isAuthenticated: true });

  await user.click(await screen.findByRole('button', { name: 'Actualizar saga' }));
  expect(await screen.findByRole('button', { name: '← Tales HD' })).toBeInTheDocument();
  expect(screen.queryByText('Tales Tres')).not.toBeInTheDocument();
});

test('una portada que falla muestra el título en un recuadro', async () => {
  mockFetch({ 'GET /sagas/39': { body: detail } });
  renderDetail();
  const img = await screen.findByAltText('Tales Uno');
  fireEvent.error(img);
  expect(screen.queryByAltText('Tales Uno')).not.toBeInTheDocument();
  expect(screen.getByText('Tales Uno')).toBeInTheDocument();
});

describe('archivar juegos', () => {
  const withArchived = { ...detail, archived: [{ igdb_id: 9, name: 'Tales Spin-off', release_year: 1999, cover_url: null }] };
  const afterArchive = {
    ...detail,
    counts: { completed: 1, pending: 1, missing: 0, total: 2 },
    groups: [detail.groups[0]],
    archived: [...withArchived.archived, { igdb_id: 3, name: 'Tales Tres', release_year: null, cover_url: null }],
  };

  test('sin sesión no aparece el menú de opciones', async () => {
    mockFetch({ 'GET /sagas/39': { body: withArchived } });
    renderDetail();
    await screen.findByRole('button', { name: '← Tales' });
    expect(screen.queryByRole('button', { name: 'Más opciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Archivar/ })).not.toBeInTheDocument();
  });

  test('desde el menú se entra al modo archivar y la ✕ archiva el juego', async () => {
    mockFetch({ 'GET /sagas/39': { body: withArchived }, 'PUT /sagas/games/3/archive': { body: afterArchive } });
    const user = userEvent.setup();
    renderDetail({ isAuthenticated: true });
    await screen.findByRole('button', { name: '← Tales' });

    expect(screen.queryByRole('button', { name: 'Archivar Tales Tres' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Archivar juegos' }));

    await user.click(screen.getByRole('button', { name: 'Archivar Tales Tres' }));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/sagas\/games\/3\/archive$/), expect.objectContaining({ method: 'PUT' }));
    expect(await screen.findByText('1 completado · 1 pendiente · te faltan 0 de 2')).toBeInTheDocument();
    expect(screen.queryByText('Tales Tres')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('button', { name: /^Archivar Tales/ })).not.toBeInTheDocument();
  });

  test('la lista de archivados muestra la cantidad y permite restaurar', async () => {
    mockFetch({ 'GET /sagas/39': { body: withArchived }, 'DELETE /sagas/games/9/archive': { body: { ...detail, archived: [] } } });
    const user = userEvent.setup();
    renderDetail({ isAuthenticated: true });
    await screen.findByRole('button', { name: '← Tales' });

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Archivados (1)' }));
    expect(screen.getByText('Tales Spin-off')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restaurar Tales Spin-off' }));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/sagas\/games\/9\/archive$/), expect.objectContaining({ method: 'DELETE' }));
    expect(await screen.findByText('No hay juegos archivados.')).toBeInTheDocument();
  });

  test('si falla el archivo muestra el error y deja el juego', async () => {
    mockFetch({ 'GET /sagas/39': { body: withArchived }, 'PUT /sagas/games/3/archive': { status: 500, body: { error: 'No se pudo archivar el juego' } } });
    const user = userEvent.setup();
    renderDetail({ isAuthenticated: true });
    await screen.findByRole('button', { name: '← Tales' });

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Archivar juegos' }));
    await user.click(screen.getByRole('button', { name: 'Archivar Tales Tres' }));
    expect(await screen.findByText('No se pudo archivar el juego')).toBeInTheDocument();
    expect(screen.getByText('Tales Tres')).toBeInTheDocument();
  });

  test('el menú se cierra con Escape', async () => {
    mockFetch({ 'GET /sagas/39': { body: withArchived } });
    const user = userEvent.setup();
    renderDetail({ isAuthenticated: true });
    await screen.findByRole('button', { name: '← Tales' });
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
