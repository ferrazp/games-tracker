import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GameForm from './GameForm';

const mockGetHeaders = vi.fn(() => ({ 'Content-Type': 'application/json' }));
const mockConsoles = [
  { id: 1, name: 'PlayStation', image: null, launch_year: 1994 },
  { id: 2, name: 'Nintendo', image: 'data:image/png;base64,abc', launch_year: null },
];
const testGame = { id: 1, name: 'Test Game', cover: { url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' } };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ consoles: mockConsoles }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderForm() {
  return render(<GameForm onGameAdded={vi.fn()} getHeaders={mockGetHeaders} />);
}

it('renders form with title input and submit button', async () => {
  renderForm();
  expect(screen.getByPlaceholderText('Buscá un juego del catálogo...')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Seleccioná un juego del catálogo' })).toBeInTheDocument();
});

it('loads consoles on mount', async () => {
  renderForm();
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/consoles'));
  });
});

it('shows console dropdown options when opened', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderForm();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  await user.click(screen.getByRole('button', { name: /Seleccionar consola/ }));
  expect(screen.getByText('PlayStation')).toBeInTheDocument();
  expect(screen.getByText('Nintendo')).toBeInTheDocument();
});

it('selects a console from dropdown', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderForm();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  await user.click(screen.getByRole('button', { name: /Seleccionar consola/ }));
  await user.click(screen.getByText('PlayStation'));
  expect(screen.getByText('PlayStation')).toBeInTheDocument();
});

it('disables year picker when no console selected', async () => {
  renderForm();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const datePickerInput = screen.getByPlaceholderText('Primero seleccioná una consola');
  expect(datePickerInput).toBeDisabled();
});

it('triggers search when typing', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderForm();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  const titleInput = screen.getByPlaceholderText('Buscá un juego del catálogo...');
  await user.type(titleInput, 'Mario');
  await vi.advanceTimersByTimeAsync(500);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(global.fetch.mock.calls[1][0]).toContain('/search');
});

it('shows search hint when typing', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderForm();

  const titleInput = screen.getByPlaceholderText('Buscá un juego del catálogo...');
  await user.type(titleInput, 'Mario');

  expect(screen.getByText('Seleccioná un juego de la lista de resultados')).toBeInTheDocument();
});

it('shows no hint when field is empty', () => {
  renderForm();
  expect(screen.queryByText('Seleccioná un juego de la lista de resultados')).not.toBeInTheDocument();
});

it('shows submit button disabled when no title locked', async () => {
  renderForm();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const submitBtn = screen.getByRole('button', { name: 'Seleccioná un juego del catálogo' });
  expect(submitBtn).toBeDisabled();
});

it('shows error when submitting without selecting game', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderForm();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());

  await user.click(screen.getByRole('button', { name: 'Seleccioná un juego del catálogo' }));
  expect(screen.getByText(/Seleccioná un juego del catálogo/)).toBeInTheDocument();
});

async function completeGameSelection(user, onGameAdded) {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ consoles: mockConsoles }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [testGame] }) });

  render(<GameForm onGameAdded={onGameAdded} getHeaders={mockGetHeaders} />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

  await user.click(screen.getByRole('button', { name: /Seleccionar consola/ }));
  await user.click(screen.getByText('PlayStation'));

  const titleInput = screen.getByPlaceholderText('Buscá un juego del catálogo...');
  await user.type(titleInput, 'Test');
  await vi.advanceTimersByTimeAsync(500);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

  await waitFor(() => expect(screen.getByText('Test Game')).toBeInTheDocument());
  await user.click(screen.getByText('Test Game'));
}

it('submits successfully and calls onGameAdded', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const onGameAdded = vi.fn();

  await completeGameSelection(user, onGameAdded);

  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ game: { id: 1 } }) });

  const submitBtn = await screen.findByRole('button', { name: /^Agregar juego$/ });
  await user.click(submitBtn);
  await vi.advanceTimersByTimeAsync(100);

  await waitFor(() => {
    expect(screen.getByText('Juego agregado correctamente')).toBeInTheDocument();
  });
  expect(onGameAdded).toHaveBeenCalled();
});

it('shows error feedback on failed submit', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await completeGameSelection(user, vi.fn());

  global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Error al guardar' }) });

  const submitBtn = await screen.findByRole('button', { name: /^Agregar juego$/ });
  await user.click(submitBtn);
  await vi.advanceTimersByTimeAsync(100);

  await waitFor(() => {
    expect(screen.getByText('Error al guardar')).toBeInTheDocument();
  });
});

it('shows loading state on submit button', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await completeGameSelection(user, vi.fn());

  global.fetch.mockReturnValueOnce(new Promise(() => {}));

  const submitBtn = await screen.findByRole('button', { name: /^Agregar juego$/ });
  await user.click(submitBtn);
  await vi.advanceTimersByTimeAsync(100);

  expect(await screen.findByText('Guardando...')).toBeInTheDocument();
});
