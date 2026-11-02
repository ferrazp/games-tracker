import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from './App';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test('renders login screen when no token', () => {
  render(<App />);
  expect(screen.getByText(/Games Tracker/i)).toBeInTheDocument();
  expect(screen.getByText(/Acceder/i)).toBeInTheDocument();
});

test('renders authenticated UI when token is present', async () => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));
  global.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      json: async () => {
        if (url.includes('/games')) return { games: [] };
        return { consoles: [] };
      },
    })
  );

  render(<App />);

  expect(screen.getByText('Registro de Juegos')).toBeInTheDocument();
  expect(screen.getByText('testuser')).toBeInTheDocument();
  expect(screen.getByText('Salir')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Buscá un juego del catálogo...')).toBeInTheDocument();

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/games'));
  });
});

test('renders games list with edit/delete buttons', async () => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));

  const mockGames = [
    { id: 1, title: 'Game 1', console_name: 'PlayStation', year_played: 2023, completed: false, hours_played: null, image: null, release_year: null, month_played: null, year_completed: null, month_completed: null },
    { id: 2, title: 'Game 2', console_name: 'Nintendo', year_played: 2024, completed: true, hours_played: 20, image: 'data:image/png;base64,abc', release_year: 2024, month_played: 1, year_completed: 2024, month_completed: 3 },
  ];

  global.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      json: async () => {
        if (url.includes('/games')) return { games: mockGames };
        return { consoles: [] };
      },
    })
  );

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText('Game 1')).toBeInTheDocument();
  });
  expect(screen.getByText('Game 2')).toBeInTheDocument();
  expect(screen.getByText('Lista de Juegos (2)')).toBeInTheDocument();

  const editButtons = screen.getAllByText('Editar');
  expect(editButtons).toHaveLength(2);
  const deleteButtons = screen.getAllByText('Eliminar');
  expect(deleteButtons).toHaveLength(2);
});

test('logout clears token and shows login screen', async () => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));
  global.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      json: async () => {
        if (url.includes('/games')) return { games: [] };
        return { consoles: [] };
      },
    })
  );

  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByText('Registro de Juegos')).toBeInTheDocument();

  await user.click(screen.getByText('Salir'));

  expect(localStorage.getItem('token')).toBeNull();
  expect(screen.getByText(/Games Tracker/i)).toBeInTheDocument();
});

test('paginates games list with "Cargar más" using backend total', async () => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));
  const all = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, title: `Juego ${i + 1}`, console_name: 'PC', completed: false }));
  global.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({
      ok: true,
      json: async () => {
        if (url.includes('/games')) {
          const offset = Number(new URL(url).searchParams.get('offset') || 0);
          return { games: all.slice(offset, offset + 20), total: 25, limit: 20, offset };
        }
        return { consoles: [] };
      },
    })
  );

  const user = userEvent.setup();
  render(<App />);

  await waitFor(() => expect(screen.getByText('Juego 20')).toBeInTheDocument());
  expect(screen.queryByText('Juego 21')).not.toBeInTheDocument();
  expect(screen.getByText('Lista de Juegos (25)')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Cargar más/ }));

  await waitFor(() => expect(screen.getByText('Juego 25')).toBeInTheDocument());
  expect(screen.getByText('Juego 1')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cargar más/ })).not.toBeInTheDocument();
});

test('"Reintentar" reloads keeping the active filters', async () => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));
  let calls = 0;
  global.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/games')) {
      calls++;
      if (calls === 1) return Promise.resolve({ ok: false, json: async () => ({}) });
      return Promise.resolve({ ok: true, json: async () => ({ games: [], total: 0 }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({ consoles: [] }) });
  });

  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

  await waitFor(() => expect(calls).toBe(2));
  const retryUrl = global.fetch.mock.calls.filter(([u]) => u.includes('/games'))[1][0];
  expect(retryUrl).toContain('sort_by=created_at');
});

describe('sesión vencida (401)', () => {
  const login = () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));
  };
  const game = { id: 7, title: 'Juego 7', console_name: 'PC', year_played: 2024, completed: false };

  test('un 401 en una acción cierra la sesión, avisa en el login y no muestra alert()', async () => {
    login();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    global.fetch = vi.fn().mockImplementation((url, opts = {}) => {
      if (opts.method === 'DELETE') {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'Invalid or expired token' }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => (url.includes('/games') ? { games: [game], total: 1 } : { consoles: [] }),
      });
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Eliminar'));

    expect(await screen.findByText(/Tu sesión expiró/i)).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('un 401 al abrir la wishlist también vuelve al login con el aviso', async () => {
    login();
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/wishlist')) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'Invalid or expired token' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => (url.includes('/games') ? { games: [] } : { consoles: [] }) });
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Próximos Juegos'));

    expect(await screen.findByText(/Tu sesión expiró/i)).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('un login con contraseña incorrecta (401) no muestra el aviso de sesión expirada', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Credenciales inválidas' }) });
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText(/usuario/i), 'admin');
    await user.type(screen.getByPlaceholderText(/contraseña/i), 'mala');
    await user.click(screen.getByRole('button', { name: /entrar|ingresar|acceder/i }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
    expect(screen.queryByText(/Tu sesión expiró/i)).not.toBeInTheDocument();
  });
});

test('el buscador de la lista espera a que termines de escribir (una sola búsqueda)', async () => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));
  global.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({ ok: true, status: 200, json: async () => (url.includes('/games') ? { games: [] } : { consoles: [] }) })
  );

  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByPlaceholderText('Buscar por título...'), 'mario');

  const searches = () => global.fetch.mock.calls.map(([url]) => url).filter((u) => u.includes('/games') && u.includes('q='));
  await waitFor(() => expect(searches()).toHaveLength(1), { timeout: 2000 });
  expect(searches()[0]).toContain('q=mario');
  expect(screen.getByPlaceholderText('Buscar por título...')).toHaveValue('mario');
});

test('"Limpiar" vacía también el texto del buscador', async () => {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ username: 'testuser', id: 1 }));
  global.fetch = vi.fn().mockImplementation((url) =>
    Promise.resolve({ ok: true, status: 200, json: async () => (url.includes('/games') ? { games: [] } : { consoles: [] }) })
  );

  const user = userEvent.setup();
  render(<App />);
  const input = screen.getByPlaceholderText('Buscar por título...');
  await user.type(input, 'zelda');
  await user.click(await screen.findByText('Limpiar', {}, { timeout: 2000 }));

  expect(input).toHaveValue('');
  await new Promise((r) => setTimeout(r, 600));
  const last = global.fetch.mock.calls.map(([u]) => u).filter((u) => u.includes('/games')).at(-1);
  expect(last).not.toContain('q=');
});
