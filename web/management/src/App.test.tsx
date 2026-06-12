import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the management key gate when locked', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'CLIProxyAPI Management' })).toBeTruthy();
    expect(screen.getByLabelText('Management key')).toBeTruthy();
  });
});
