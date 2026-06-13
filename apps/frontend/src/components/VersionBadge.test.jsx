import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../config', () => ({
  FRONTEND_VERSION: '9.9.9',
  fetchBackendVersion: vi.fn(),
}));

import VersionBadge from './VersionBadge';
import { fetchBackendVersion } from '../config';

beforeEach(() => {
  vi.clearAllMocks();
});

it('shows frontend version', () => {
  fetchBackendVersion.mockResolvedValue(null);
  render(<VersionBadge />);
  expect(screen.getByText('v9.9.9')).toBeInTheDocument();
});

it('shows placeholder while backend version is loading', () => {
  fetchBackendVersion.mockReturnValue(new Promise(() => {}));
  render(<VersionBadge />);
  expect(screen.getByText('...')).toBeInTheDocument();
});

it('shows backend version when loaded', async () => {
  fetchBackendVersion.mockResolvedValue('2.0.0');
  render(<VersionBadge />);
  expect(await screen.findByText('v2.0.0')).toBeInTheDocument();
});
