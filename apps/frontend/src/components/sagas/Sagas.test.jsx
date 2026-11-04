import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Sagas from './Sagas';

const getHeaders = () => ({ 'Content-Type': 'application/json' });

const saga = (id, name, counts, covers = []) => ({ id, name, counts, covers });

function mockSagas(payload, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({ ok: status === 200, status, json: async () => payload });
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('muestra una tarjeta por saga en el orden recibido, con su texto de conteo', async () => {
  mockSagas({
    configured: true,
    unresolved_count: 0,
    sagas: [
      saga(1, 'Final Fantasy', { completed: 1, pending: 1, missing: 84, total: 86 }, ['https://x/a.jpg']),
      saga(2, 'Tales', { completed: 3, pending: 0, missing: 36, total: 39 }),
    ],
  });
  render(<Sagas getHeaders={getHeaders} isAuthenticated />);

  const names = await screen.findAllByRole('heading', { level: 3 });
  expect(names.map((n) => n.textContent)).toEqual(['Final Fantasy', 'Tales']);
  expect(screen.getByText('1 completado · 1 pendiente · te faltan 84 de 86')).toBeInTheDocument();
  expect(screen.getByText('3 completados · 0 pendientes · te faltan 36 de 39')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/sagas'), expect.anything());
});

test('sin sagas muestra el texto de vacío', async () => {
  mockSagas({ configured: true, unresolved_count: 0, sagas: [] });
  render(<Sagas getHeaders={getHeaders} isAuthenticated />);
  expect(await screen.findByText('Todavía no hay sagas: registrá un juego que pertenezca a una serie y aparece acá.')).toBeInTheDocument();
});

test('sin credenciales de IGDB lo avisa', async () => {
  mockSagas({ configured: false, unresolved_count: 0, sagas: [] });
  render(<Sagas getHeaders={getHeaders} isAuthenticated />);
  expect(await screen.findByText('Para ver sagas hace falta configurar las credenciales de IGDB.')).toBeInTheDocument();
});

test('con juegos sin identificar y sesión muestra el aviso', async () => {
  mockSagas({ configured: true, unresolved_count: 2, sagas: [] });
  render(<Sagas getHeaders={getHeaders} isAuthenticated />);
  expect(await screen.findByRole('button', { name: '2 juegos sin identificar — revisar' })).toBeInTheDocument();
});

test('sin sesión no muestra el aviso de juegos sin identificar', async () => {
  mockSagas({ configured: true, unresolved_count: 2, sagas: [saga(1, 'Zelda', { completed: 1, pending: 0, missing: 0, total: 1 })] });
  render(<Sagas getHeaders={getHeaders} isAuthenticated={false} />);
  await screen.findByText('Zelda');
  expect(screen.queryByText(/sin identificar/)).not.toBeInTheDocument();
});

test('clic en una tarjeta muestra el detalle y "← <nombre>" vuelve a la grilla', async () => {
  mockSagas({
    configured: true,
    unresolved_count: 0,
    sagas: [saga(7, 'Zelda', { completed: 1, pending: 0, missing: 0, total: 1 })],
  });
  const list = global.fetch;
  global.fetch = vi.fn((url, options) => (url.endsWith('/sagas/7')
    ? Promise.resolve({ ok: true, status: 200, json: async () => ({ id: 7, name: 'Zelda', counts: { completed: 1, pending: 0, missing: 0, total: 1 }, groups: [] }) })
    : list(url, options)));
  const user = userEvent.setup();
  render(<Sagas getHeaders={getHeaders} isAuthenticated />);

  await user.click(await screen.findByText('Zelda'));
  expect(await screen.findByRole('button', { name: '← Zelda' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '← Zelda' }));
  expect(await screen.findByText('1 completado · 0 pendientes · te faltan 0 de 1')).toBeInTheDocument();
});

test('el aviso abre la revisión de juegos sin identificar y "Volver" regresa', async () => {
  global.fetch = vi.fn((url) => Promise.resolve({
    ok: true,
    status: 200,
    json: async () => (url.endsWith('/sagas/unresolved')
      ? [{ id: 7, title: 'Tales', console_name: 'PS2', candidates: [] }]
      : { configured: true, unresolved_count: 1, sagas: [] }),
  }));
  const user = userEvent.setup();
  render(<Sagas getHeaders={getHeaders} isAuthenticated />);

  await user.click(await screen.findByRole('button', { name: '1 juego sin identificar — revisar' }));
  await user.click(await screen.findByRole('button', { name: 'Volver' }));
  expect(await screen.findByRole('button', { name: '1 juego sin identificar — revisar' })).toBeInTheDocument();
});

test('una respuesta vieja que llega tarde no pisa a la más reciente', async () => {
  const body = (name) => ({ configured: true, unresolved_count: 0, sagas: [saga(1, name, { completed: 1, pending: 0, missing: 0, total: 1 })] });
  let resolveOld;
  global.fetch = vi.fn()
    .mockReturnValueOnce(new Promise((r) => { resolveOld = r; }))
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => body('Nueva') });

  const { rerender } = render(<Sagas getHeaders={() => ({})} isAuthenticated />);
  rerender(<Sagas getHeaders={() => ({})} isAuthenticated />); // getHeaders nuevo => segunda carga
  expect(await screen.findByText('Nueva')).toBeInTheDocument();

  resolveOld({ ok: true, status: 200, json: async () => body('Vieja') });
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.getByText('Nueva')).toBeInTheDocument();
  expect(screen.queryByText('Vieja')).not.toBeInTheDocument();
});
