export const MANAGEMENT_KEY_STORAGE = 'cliproxyapi.managementKey';
export const MANAGEMENT_LOCK_EVENT = 'cliproxyapi:management-lock';

export type ApiErrorPayload = {
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | string | null;

  constructor(status: number, payload: ApiErrorPayload | string | null) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || payload?.error || `Request failed with status ${status}`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function getManagementKey(): string {
  return sessionStorage.getItem(MANAGEMENT_KEY_STORAGE) || '';
}

export function setManagementKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    sessionStorage.setItem(MANAGEMENT_KEY_STORAGE, trimmed);
  } else {
    sessionStorage.removeItem(MANAGEMENT_KEY_STORAGE);
  }
}

export function clearManagementKey(): void {
  sessionStorage.removeItem(MANAGEMENT_KEY_STORAGE);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithManagementAuth(path, init);

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await fetchWithManagementAuth(path);
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
  return response.blob();
}

async function fetchWithManagementAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const key = getManagementKey();
  if (key) {
    headers.set('Authorization', `Bearer ${key}`);
  }
  if (init.body && !headers.has('Content-Type') && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    clearManagementKey();
    window.dispatchEvent(new CustomEvent(MANAGEMENT_LOCK_EVENT));
  }

  return response;
}

async function parseError(response: Response): Promise<ApiErrorPayload | string | null> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as ApiErrorPayload;
    } catch {
      return null;
    }
  }
  const text = await response.text();
  return text.trim() || null;
}

export const managementApi = {
  get: <T>(path: string) => apiRequest<T>(`/v0/management${path}`),
  delete: <T>(path: string) => apiRequest<T>(`/v0/management${path}`, { method: 'DELETE' }),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(`/v0/management${path}`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown, contentType?: string) =>
    apiRequest<T>(`/v0/management${path}`, {
      method: 'PUT',
      headers: contentType ? { 'Content-Type': contentType } : undefined,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(`/v0/management${path}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export async function getHealth(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/healthz');
}
