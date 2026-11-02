import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Login from './Login';

const mockOnLogin = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

it('renders login form with title and button', () => {
  render(<Login onLogin={mockOnLogin} />);
  expect(screen.getByText('Games Tracker')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Acceder' })).toBeInTheDocument();
});

it('shows validation error when fields are empty', async () => {
  const user = userEvent.setup();
  render(<Login onLogin={mockOnLogin} />);
  await user.click(screen.getByRole('button', { name: 'Acceder' }));
  expect(screen.getByText('Completa todos los campos')).toBeInTheDocument();
});

it('shows loading state while submitting', async () => {
  const user = userEvent.setup();
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
  render(<Login onLogin={mockOnLogin} />);
  await user.type(screen.getByLabelText('Usuario'), 'testuser');
  await user.type(screen.getByLabelText('Contraseña'), 'testpass');
  await user.click(screen.getByRole('button', { name: 'Acceder' }));
  expect(screen.getByText('Ingresando...')).toBeInTheDocument();
});

it('shows error message on failed login', async () => {
  const user = userEvent.setup();
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Credenciales inválidas' }),
  });
  render(<Login onLogin={mockOnLogin} />);
  await user.type(screen.getByLabelText('Usuario'), 'bad');
  await user.type(screen.getByLabelText('Contraseña'), 'wrong');
  await user.click(screen.getByRole('button', { name: 'Acceder' }));
  expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
});

it('calls onLogin on successful login', async () => {
  const user = userEvent.setup();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ token: 'abc123', user: { username: 'testuser' } }),
  });
  render(<Login onLogin={mockOnLogin} />);
  await user.type(screen.getByLabelText('Usuario'), 'testuser');
  await user.type(screen.getByLabelText('Contraseña'), 'testpass');
  await user.click(screen.getByRole('button', { name: 'Acceder' }));
  await waitFor(() => {
    expect(mockOnLogin).toHaveBeenCalledWith('abc123', { username: 'testuser' });
  });
});
