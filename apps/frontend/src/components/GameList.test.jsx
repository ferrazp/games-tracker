import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GameList from './GameList';

const mockGetHeaders = vi.fn(() => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer test' }));
const mockGames = [
  { id: 1, title: 'Test Game', console_name: 'PlayStation', year_played: 2024, month_played: 3, completed: true, year_completed: 2024, month_completed: 6, hours_played: 20, image: '', release_year: 2023, console_id: 1 },
  { id: 2, title: 'Another Game', console_name: 'Nintendo', year_played: 2023, month_played: null, completed: false, year_completed: null, month_completed: null, hours_played: null, image: null, release_year: null, console_id: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ consoles: [] }),
  });
});

it('shows loading state', () => {
  render(<GameList games={[]} loading={true} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText('Cargando juegos...')).toBeInTheDocument();
});

it('shows error state with retry button', () => {
  const onRefresh = vi.fn();
  render(<GameList games={[]} loading={false} error="Error de conexión" onRefresh={onRefresh} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText('Error: Error de conexión')).toBeInTheDocument();
  expect(screen.getByText('Reintentar')).toBeInTheDocument();
});

it('shows empty state', () => {
  render(<GameList games={[]} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText('No hay juegos registrados aún. Agregá uno arriba.')).toBeInTheDocument();
});

it('renders game cards', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText('Test Game')).toBeInTheDocument();
  expect(screen.getByText('Another Game')).toBeInTheDocument();
});

it('shows game count', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText('Lista de Juegos (2)')).toBeInTheDocument();
});

it('hides edit/delete buttons when not authenticated', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.queryByText('Editar')).not.toBeInTheDocument();
  expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
});

it('shows edit and delete buttons when authenticated', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={true} />);
  expect(screen.getAllByText('Editar').length).toBe(2);
  expect(screen.getAllByText('Eliminar').length).toBe(2);
});

it('enters edit mode on edit click', async () => {
  const user = userEvent.setup();
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={true} />);
  await user.click(screen.getAllByText('Editar')[0]);
  expect(screen.getByDisplayValue('Test Game')).toBeInTheDocument();
  expect(screen.getByText('Guardar')).toBeInTheDocument();
  expect(screen.getByText('Cancelar')).toBeInTheDocument();
});

it('cancels edit mode', async () => {
  const user = userEvent.setup();
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={true} />);
  await user.click(screen.getAllByText('Editar')[0]);
  await user.click(screen.getByText('Cancelar'));
  expect(screen.queryByDisplayValue('Test Game')).not.toBeInTheDocument();
});

it('saves edited game on save click', async () => {
  const user = userEvent.setup();
  const onGameUpdated = vi.fn();
  global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ consoles: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={onGameUpdated} onGameUpdated={onGameUpdated} getHeaders={mockGetHeaders} isAuthenticated={true} />);
  await user.click(screen.getAllByText('Editar')[0]);
  await user.click(screen.getByText('Guardar'));
  await waitFor(() => {
    expect(onGameUpdated).toHaveBeenCalled();
  });
});

it('shows saving state', async () => {
  const user = userEvent.setup();
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ consoles: [] }) })
    .mockReturnValueOnce(new Promise(() => {}));
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={true} />);
  await user.click(screen.getAllByText('Editar')[0]);
  await user.click(screen.getByText('Guardar'));
  expect(screen.getByText('Guardando...')).toBeInTheDocument();
});

it('deletes game on delete click', async () => {
  const user = userEvent.setup();
  const onGameDeleted = vi.fn();
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ consoles: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  window.confirm = vi.fn(() => true);
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={onGameDeleted} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={true} />);
  await user.click(screen.getAllByText('Eliminar')[0]);
  await waitFor(() => {
    expect(onGameDeleted).toHaveBeenCalled();
  });
});

it('does not delete when confirm is cancelled', async () => {
  const user = userEvent.setup();
  const onGameDeleted = vi.fn();
  window.confirm = vi.fn(() => false);
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={onGameDeleted} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={true} />);
  await user.click(screen.getAllByText('Eliminar')[0]);
  expect(onGameDeleted).not.toHaveBeenCalled();
});

it('formats played date with month and year', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText(/Mar 2024/)).toBeInTheDocument();
});

it('shows completed badge', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText('Completado')).toBeInTheDocument();
});

it('shows pending for incomplete games', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  const pendingElements = screen.getAllByText('Pendiente');
  expect(pendingElements.length).toBeGreaterThan(0);
});

it('shows release year badge when available', () => {
  render(<GameList games={mockGames} loading={false} error={null} onRefresh={vi.fn()} onGameDeleted={vi.fn()} onGameUpdated={vi.fn()} getHeaders={mockGetHeaders} isAuthenticated={false} />);
  expect(screen.getByText('2023')).toBeInTheDocument();
});
