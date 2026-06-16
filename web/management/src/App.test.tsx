import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the management key gate when locked', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'CLIProxyAPI Management' })).toBeTruthy();
    expect(screen.getByLabelText('Management key')).toBeTruthy();
  });

  it('switches the locked gate to Chinese', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh-CN' } });

    expect(screen.getByRole('heading', { name: 'CLIProxyAPI 管理' })).toBeTruthy();
    expect(screen.getByLabelText('管理密钥')).toBeTruthy();
    expect(screen.getByRole('button', { name: /解锁/ })).toBeTruthy();
  });
});
