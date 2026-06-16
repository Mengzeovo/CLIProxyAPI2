export type AppConfig = {
  debug?: boolean;
  'logging-to-file'?: boolean;
  'request-log'?: boolean;
  'proxy-url'?: string;
  'request-retry'?: number;
  'max-retry-interval'?: number;
  routing?: {
    strategy?: string;
    'session-affinity'?: boolean;
    'session-affinity-ttl'?: string;
  };
  'remote-management'?: {
    'allow-remote'?: boolean;
    'disable-control-panel'?: boolean;
    'disable-auto-update-panel'?: boolean;
    'panel-mode'?: string;
  };
  [key: string]: unknown;
};

export type RecentRequestBucket = {
  success?: number;
  failed?: number;
  Success?: number;
  Failed?: number;
  timestamp?: number;
  time?: number | string;
};

export type AuthFile = {
  id?: string;
  auth_index?: string;
  name?: string;
  type?: string;
  provider?: string;
  label?: string;
  status?: string;
  status_message?: string;
  disabled?: boolean;
  unavailable?: boolean;
  runtime_only?: boolean;
  source?: string;
  email?: string;
  project_id?: string;
  account?: string;
  account_type?: string;
  success?: number;
  failed?: number;
  size?: number;
  modtime?: string;
  updated_at?: string;
  last_refresh?: string;
  recent_requests?: RecentRequestBucket[];
  path?: string;
  note?: string;
  priority?: number;
  websockets?: boolean;
  id_token?: Record<string, unknown>;
};

export type AuthFilesResponse = {
  files: AuthFile[];
};

export type ApiKeyUsageEntry = {
  success?: number;
  failed?: number;
  recent_requests?: RecentRequestBucket[];
};

// provider -> "base_url|api_key" -> usage entry
export type ApiKeyUsageResponse = Record<string, Record<string, ApiKeyUsageEntry>>;

export type ApiKeysResponse = {
  'api-keys'?: string[];
};

export type ModelAlias = {
  name: string;
  alias: string;
  [key: string]: unknown;
};

export type ProviderApiKeyConfig = {
  'api-key': string;
  priority?: number;
  prefix?: string;
  'base-url'?: string;
  'proxy-url'?: string;
  models?: ModelAlias[];
  headers?: Record<string, string>;
  'excluded-models'?: string[];
  websockets?: boolean;
};

export type OpenAICompatibilityAPIKeyEntry = {
  'api-key': string;
  'proxy-url'?: string;
};

export type OpenAICompatibilityConfig = {
  name: string;
  priority?: number;
  disabled?: boolean;
  prefix?: string;
  'base-url': string;
  'api-key-entries'?: OpenAICompatibilityAPIKeyEntry[];
  models?: ModelAlias[];
  headers?: Record<string, string>;
};

export type ProviderApiKeyResponse = {
  'gemini-api-key'?: ProviderApiKeyConfig[];
  'claude-api-key'?: ProviderApiKeyConfig[];
  'codex-api-key'?: ProviderApiKeyConfig[];
  'vertex-api-key'?: ProviderApiKeyConfig[];
  'openai-compatibility'?: OpenAICompatibilityConfig[];
};

export type AuthUploadResponse = {
  status: string;
  uploaded?: number;
  files?: string[];
  failed?: Array<{ name?: string; error?: string }>;
  'auth-file'?: string;
  project_id?: string;
  email?: string;
  location?: string;
};

export type LogsResponse = {
  lines: string[];
  'line-count': number;
  'latest-timestamp': number;
};

export type RequestErrorLog = {
  name: string;
  size: number;
  modified: number;
};

export type ApiCallResponse = {
  status_code: number;
  header: Record<string, string[]>;
  body: string;
};
