import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Wishlist from './Wishlist';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('sends auth headers on IGDB online search', async () => {
  const getHeaders = vi.fn(() => ({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' }));
  global.fetch = vi.fn((url) => {
    if (url.endsWith('/wishlist')) return Promise.resolve({ ok: true, json: async () => ({ games: [] }) });
    if (url.endsWith('/search')) return Promise.resolve({ ok: true, json: async () => ({ results: [], online_available: true }) });
    return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
  });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<Wishlist getHeaders={getHeaders} />);

  await user.type(screen.getByPlaceholderText('Buscá un juego del catálogo para agregar...'), 'Zelda');
  await vi.advanceTimersByTimeAsync(500);
  await user.click(await screen.findByRole('button', { name: /Buscar en IGDB/ }));

  await waitFor(() => {
    const call = global.fetch.mock.calls.find(([url]) => url.endsWith('/search/online'));
    expect(call).toBeTruthy();
    expect(call[1].headers.Authorization).toBe('Bearer tok');
  });
});
