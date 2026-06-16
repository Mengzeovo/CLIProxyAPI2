import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, MANAGEMENT_KEY_STORAGE, apiDownload, apiRequest, apiUpload, clearManagementKey, setManagementKey } from './api';

describe('apiRequest', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('injects bearer token from sessionStorage', async () => {
    setManagementKey('secret-key');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/v0/management/config')).resolves.toEqual({ ok: true });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer secret-key');
  });

  it('clears key and emits lock event on 401', async () => {
    setManagementKey('bad-key');
    const listener = vi.fn();
    window.addEventListener('cliproxyapi:management-lock', listener);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(apiRequest('/v0/management/config')).rejects.toBeInstanceOf(ApiError);
    expect(sessionStorage.getItem(MANAGEMENT_KEY_STORAGE)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('parses text error responses', async () => {
    clearManagementKey();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })));

    await expect(apiRequest('/missing')).rejects.toMatchObject({
      status: 404,
      message: 'not found',
    });
  });

  it('uses bearer token for blob downloads', async () => {
    setManagementKey('download-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response('payload', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const blob = await apiDownload('/v0/management/auth-files/download?name=a.json');

    expect(blob).toBeTruthy();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer download-key');
  });

  it('uses bearer token for FormData uploads without setting content type', async () => {
    setManagementKey('upload-key');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('file', new File(['{}'], 'auth.json', { type: 'application/json' }));

    await expect(apiUpload('/v0/management/auth-files', formData)).resolves.toEqual({ status: 'ok' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer upload-key');
    expect(headers.has('Content-Type')).toBe(false);
    expect(init.body).toBe(formData);
  });
});
