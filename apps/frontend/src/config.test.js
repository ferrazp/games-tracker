import { afterEach, describe, expect, it, vi } from 'vitest';

describe('API_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('usa VITE_API_URL relativa cuando está definida', async () => {
    vi.stubEnv('VITE_API_URL', '/api');
    vi.resetModules();
    const { default: API_URL } = await import('./config.js');
    expect(API_URL).toBe('/api');
  });

  it('usa http://localhost:4000 en dev sin variable', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.resetModules();
    const { default: API_URL } = await import('./config.js');
    expect(API_URL).toBe('http://localhost:4000');
  });
});
