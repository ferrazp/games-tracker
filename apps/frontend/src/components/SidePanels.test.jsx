import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SidePanels from './SidePanels';

const images = (container) => [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ covers: ['https://x/random.jpg'] }) });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('sin portadas propias muestra las aleatorias del backend', async () => {
  const { container } = render(<SidePanels consoleId={null} />);
  await waitFor(() => expect(images(container)).toEqual(['https://x/random.jpg']));
});

test('con portadas propias muestra esas en lugar de las aleatorias', async () => {
  const { container } = render(<SidePanels consoleId={null} covers={['https://x/a.jpg', 'https://x/b.jpg']} />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(images(container)).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
});

test('con una lista vacía vuelve a las aleatorias', async () => {
  const { container } = render(<SidePanels consoleId={null} covers={[]} />);
  await waitFor(() => expect(images(container)).toEqual(['https://x/random.jpg']));
});
