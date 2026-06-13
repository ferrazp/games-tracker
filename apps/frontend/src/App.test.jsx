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
