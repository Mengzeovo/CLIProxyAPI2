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
  time?: number;
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
