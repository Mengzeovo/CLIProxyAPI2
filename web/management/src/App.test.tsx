import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { setManagementKey } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderUnlocked(fetchMock?: ReturnType<typeof vi.fn>) {
  setManagementKey('management-key');
  const mock =
    fetchMock ||
    vi.fn((url: string) => {
      if (url.endsWith('/healthz')) return Promise.resolve(jsonResponse({ status: 'ok' }));
      if (url.endsWith('/v0/management/config')) return Promise.resolve(jsonResponse({}));
      if (url.endsWith('/v0/management/auth-files')) return Promise.resolve(jsonResponse({ files: [] }));
      if (url.includes('/v0/management/usage-queue')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse({}));
    });
  vi.stubGlobal('fetch', mock);
  render(<App />);
  return mock;
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
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

  it('opens the add credential modal and switches tabs', async () => {
    renderUnlocked();

    fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: /Add credential/ }));

    expect(screen.getByRole('dialog', { name: 'Add credential' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OAuth login' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Upload file' }));
    expect(screen.getByText('Auth JSON files')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'API key' }));
    expect(screen.getByLabelText('API key provider')).toBeTruthy();
  });

  it('uploads auth JSON files from the modal', async () => {
    const fetchMock = renderUnlocked(
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/healthz')) return Promise.resolve(jsonResponse({ status: 'ok' }));
        if (url.endsWith('/v0/management/config')) return Promise.resolve(jsonResponse({}));
        if (url.endsWith('/v0/management/auth-files') && init?.method === 'POST') return Promise.resolve(jsonResponse({ status: 'ok' }));
        if (url.endsWith('/v0/management/auth-files')) return Promise.resolve(jsonResponse({ files: [] }));
        if (url.includes('/v0/management/usage-queue')) return Promise.resolve(jsonResponse([]));
        return Promise.resolve(jsonResponse({}));
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: /Add credential/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload file' }));
    fireEvent.change(screen.getByLabelText('Auth JSON files'), {
      target: { files: [new File(['{"type":"claude"}'], 'claude.json', { type: 'application/json' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(screen.getByText('Upload complete')).toBeTruthy());
    const uploadCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/v0/management/auth-files') && init?.method === 'POST');
    expect(uploadCall).toBeTruthy();
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
  });

  it('imports a Vertex service account with the default location', async () => {
    const fetchMock = renderUnlocked(
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/healthz')) return Promise.resolve(jsonResponse({ status: 'ok' }));
        if (url.endsWith('/v0/management/config')) return Promise.resolve(jsonResponse({}));
        if (url.endsWith('/v0/management/vertex/import')) return Promise.resolve(jsonResponse({ status: 'ok' }));
        if (url.endsWith('/v0/management/auth-files')) return Promise.resolve(jsonResponse({ files: [] }));
        if (url.includes('/v0/management/usage-queue')) return Promise.resolve(jsonResponse([]));
        return Promise.resolve(jsonResponse({}));
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: /Add credential/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload file' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vertex service account JSON' }));
    fireEvent.change(screen.getByLabelText('Vertex service account JSON'), {
      target: { files: [new File(['{"project_id":"p"}'], 'vertex.json', { type: 'application/json' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import Vertex' }));

    await waitFor(() => expect(screen.getByText('Vertex credential imported')).toBeTruthy());
    const uploadCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/v0/management/vertex/import'));
    const body = uploadCall?.[1]?.body as FormData;
    expect(body.get('location')).toBe('us-central1');
  });

  it('appends a Gemini API key through provider config endpoints', async () => {
    const fetchMock = renderUnlocked(
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/healthz')) return Promise.resolve(jsonResponse({ status: 'ok' }));
        if (url.endsWith('/v0/management/config')) return Promise.resolve(jsonResponse({}));
        if (url.endsWith('/v0/management/gemini-api-key') && init?.method !== 'PUT') {
          return Promise.resolve(jsonResponse({ 'gemini-api-key': [{ 'api-key': 'old-key' }] }));
        }
        if (url.endsWith('/v0/management/gemini-api-key') && init?.method === 'PUT') return Promise.resolve(jsonResponse({ status: 'ok' }));
        if (url.endsWith('/v0/management/auth-files')) return Promise.resolve(jsonResponse({ files: [] }));
        if (url.includes('/v0/management/usage-queue')) return Promise.resolve(jsonResponse([]));
        return Promise.resolve(jsonResponse({}));
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: /Add credential/ }));
    fireEvent.click(screen.getByRole('button', { name: 'API key' }));
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'new-key' } });
    fireEvent.change(screen.getByLabelText('Headers JSON'), { target: { value: '{"X-Test":"1"}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add API key' }));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/v0/management/gemini-api-key') && init?.method === 'PUT');
      expect(putCall).toBeTruthy();
      expect(JSON.parse(String(putCall?.[1]?.body))).toEqual([
        { 'api-key': 'old-key' },
        { 'api-key': 'new-key', headers: { 'X-Test': '1' } },
      ]);
    });
    expect(screen.getByText('API key saved')).toBeTruthy();
  });

  it('shows JSON validation errors before saving an API key', async () => {
    const fetchMock = renderUnlocked();

    fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
    fireEvent.click(await screen.findByRole('button', { name: /Add credential/ }));
    fireEvent.click(screen.getByRole('button', { name: 'API key' }));
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'new-key' } });
    fireEvent.change(screen.getByLabelText('Headers JSON'), { target: { value: '[]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add API key' }));

    expect(await screen.findByText('Headers JSON must be a JSON object')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/v0/management/gemini-api-key'))).toBe(false);
  });
});
