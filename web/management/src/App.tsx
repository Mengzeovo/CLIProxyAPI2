import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Code2,
  Download,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  Moon,
  Play,
  RefreshCcw,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  Sun,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from '@tanstack/react-table';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  MANAGEMENT_LOCK_EVENT,
  getHealth,
  getManagementKey,
  apiDownload,
  managementApi,
  setManagementKey,
  clearManagementKey,
} from './api';
import type { ApiCallResponse, AppConfig, AuthFile, AuthFilesResponse, LogsResponse, RequestErrorLog } from './types';
import { buildLineDiff, bytes, formatDate, maskSecret, providerOf, recentTotals, statusOf, successRate } from './utils';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type View = 'overview' | 'accounts' | 'config' | 'logs' | 'playground';

const navItems: Array<{ id: View; label: string; icon: typeof Activity }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'accounts', label: 'Accounts', icon: KeyRound },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'playground', label: 'API Test', icon: Play },
];

async function downloadManagementFile(path: string, filename: string) {
  const blob = await apiDownload(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ManagementApp />
    </QueryClientProvider>
  );
}

function ManagementApp() {
  const [locked, setLocked] = useState(!getManagementKey());

  useEffect(() => {
    const onLock = () => setLocked(true);
    window.addEventListener(MANAGEMENT_LOCK_EVENT, onLock);
    return () => window.removeEventListener(MANAGEMENT_LOCK_EVENT, onLock);
  }, []);

  if (locked) {
    return <AuthGate onUnlock={() => setLocked(false)} />;
  }
  return <ConsoleShell onLock={() => setLocked(true)} />;
}

function AuthGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const testKey = useMutation({
    mutationFn: async () => {
      setManagementKey(key);
      return managementApi.get<AppConfig>('/config');
    },
    onSuccess: () => {
      setError('');
      onUnlock();
    },
    onError: (err) => {
      clearManagementKey();
      setError(err instanceof Error ? err.message : 'Unable to unlock management API');
    },
  });

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-mark">
          <Shield size={28} />
        </div>
        <h1>CLIProxyAPI Management</h1>
        <p>Enter the management key for this browser session.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!key.trim()) {
              setError('Management key is required');
              return;
            }
            testKey.mutate();
          }}
        >
          <input name="username" type="hidden" autoComplete="username" value="management" readOnly />
          <label htmlFor="management-key">Management key</label>
          <input
            id="management-key"
            type="password"
            value={key}
            autoFocus
            autoComplete="current-password"
            onChange={(event) => setKey(event.target.value)}
          />
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary full" type="submit" disabled={testKey.isPending}>
            {testKey.isPending ? <Loader2 className="spin" size={16} /> : <Unlock size={16} />}
            Unlock
          </button>
        </form>
      </section>
    </main>
  );
}

function ConsoleShell({ onLock }: { onLock: () => void }) {
  const [view, setView] = useState<View>('overview');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [selectedAuth, setSelectedAuth] = useState<AuthFile | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 15000 });
  const config = useQuery({ queryKey: ['config'], queryFn: () => managementApi.get<AppConfig>('/config') });
  const authFiles = useQuery({
    queryKey: ['auth-files'],
    queryFn: () => managementApi.get<AuthFilesResponse>('/auth-files'),
    refetchInterval: 20000,
  });
  const usageQueue = useQuery({
    queryKey: ['usage-queue'],
    queryFn: () => managementApi.get<unknown[]>('/usage-queue?count=20'),
    refetchInterval: 15000,
  });

  const accounts = authFiles.data?.files || [];
  const activeView = navItems.find((item) => item.id === view);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">CP</div>
          <div>
            <strong>CLIProxyAPI</strong>
            <span>Management</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button
          className="sidebar-lock"
          onClick={() => {
            clearManagementKey();
            qc.clear();
            onLock();
          }}
        >
          <Lock size={16} />
          Lock session
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="crumb">
              Management <ChevronRight size={14} /> {activeView?.label}
            </div>
            <h1>{activeView?.label}</h1>
          </div>
          <div className="top-actions">
            <StatusPill ok={health.data?.status === 'ok'} label={health.data?.status === 'ok' ? 'Service online' : 'Health pending'} />
            <button className="icon-button" title="Refresh" onClick={() => qc.invalidateQueries()}>
              <RefreshCcw size={17} />
            </button>
            <button className="icon-button" title="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        <section className="content">
          {view === 'overview' ? (
            <Overview config={config.data} accounts={accounts} usageRecords={usageQueue.data || []} loading={config.isLoading || authFiles.isLoading} />
          ) : null}
          {view === 'accounts' ? <Accounts accounts={accounts} loading={authFiles.isLoading} onSelect={setSelectedAuth} /> : null}
          {view === 'config' ? <ConfigPage config={config.data} /> : null}
          {view === 'logs' ? <LogsPage config={config.data} /> : null}
          {view === 'playground' ? <Playground accounts={accounts} /> : null}
        </section>
      </main>

      <AccountDrawer auth={selectedAuth} onClose={() => setSelectedAuth(null)} />
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`status-pill ${ok ? 'ok' : 'warn'}`}>
      {ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {label}
    </span>
  );
}

function Overview({ config, accounts, usageRecords, loading }: { config?: AppConfig; accounts: AuthFile[]; usageRecords: unknown[]; loading: boolean }) {
  const byProvider = useMemo(() => {
    const groups = new Map<string, AuthFile[]>();
    for (const auth of accounts) {
      const provider = providerOf(auth);
      groups.set(provider, [...(groups.get(provider) || []), auth]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [accounts]);

  const enabled = accounts.filter((auth) => !auth.disabled).length;
  const unavailable = accounts.filter((auth) => auth.unavailable || statusOf(auth) === 'failed').length;

  return (
    <div className="page-grid">
      <div className="metric-row">
        <Metric icon={Server} label="Service" value={loading ? 'Loading' : 'Online'} tone="green" />
        <Metric icon={KeyRound} label="Accounts" value={`${enabled}/${accounts.length}`} detail="enabled / total" tone="blue" />
        <Metric icon={AlertTriangle} label="Unavailable" value={String(unavailable)} tone={unavailable > 0 ? 'red' : 'green'} />
        <Metric icon={Activity} label="Recent records" value={String(usageRecords.length)} tone="amber" />
      </div>

      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <h2>Provider Health Matrix</h2>
            <p>Account availability and recent request success by provider.</p>
          </div>
        </div>
        <div className="matrix">
          <div className="matrix-head">
            <span>Provider</span>
            <span>Total</span>
            <span>Enabled</span>
            <span>Unavailable</span>
            <span>Success</span>
          </div>
          {byProvider.length === 0 ? <EmptyState icon={KeyRound} title="No accounts found" /> : null}
          {byProvider.map(([provider, providerAccounts]) => {
            const disabled = providerAccounts.filter((auth) => auth.disabled).length;
            const failed = providerAccounts.filter((auth) => auth.unavailable || statusOf(auth) === 'failed').length;
            return (
              <div className="matrix-row" key={provider}>
                <span className="mono">{provider}</span>
                <span>{providerAccounts.length}</span>
                <span>{providerAccounts.length - disabled}</span>
                <span>{failed}</span>
                <span>{successRate(providerAccounts)}%</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Configuration</h2>
        <div className="kv-list">
          <KV label="Debug" value={String(Boolean(config?.debug))} />
          <KV label="Logging to file" value={String(Boolean(config?.['logging-to-file']))} />
          <KV label="Request log" value={String(Boolean(config?.['request-log']))} />
          <KV label="Proxy URL" value={config?.['proxy-url'] ? 'configured' : 'direct'} />
          <KV label="Routing" value={config?.routing?.strategy || 'round-robin'} />
          <KV label="Retry" value={String(config?.['request-retry'] ?? 0)} />
        </div>
      </section>

      <section className="panel">
        <h2>Management API</h2>
        <div className="kv-list">
          <KV label="Panel mode" value={config?.['remote-management']?.['panel-mode'] || 'builtin'} />
          <KV label="Remote access" value={String(Boolean(config?.['remote-management']?.['allow-remote']))} />
          <KV label="Control panel" value={config?.['remote-management']?.['disable-control-panel'] ? 'disabled' : 'enabled'} />
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail?: string; tone: string }) {
  return (
    <section className={`metric ${tone}`}>
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
  );
}

function Accounts({ accounts, loading, onSelect }: { accounts: AuthFile[]; loading: boolean; onSelect: (auth: AuthFile) => void }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const qc = useQueryClient();
  const providers = useMemo(() => ['all', ...Array.from(new Set(accounts.map(providerOf))).sort()], [accounts]);

  const rows = useMemo(
    () => accounts.filter((auth) => providerFilter === 'all' || providerOf(auth) === providerFilter),
    [accounts, providerFilter],
  );

  const statusMutation = useMutation({
    mutationFn: ({ auth, disabled }: { auth: AuthFile; disabled: boolean }) =>
      managementApi.patch('/auth-files/status', { name: auth.name, auth_index: auth.auth_index, disabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-files'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (auth: AuthFile) => managementApi.delete(`/auth-files?name=${encodeURIComponent(auth.name || '')}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-files'] }),
  });

  const column = createColumnHelper<AuthFile>();
  const columns = useMemo(
    () => [
      column.accessor((row) => providerOf(row), {
        id: 'provider',
        header: 'Provider',
        cell: (ctx) => <span className="chip neutral mono">{ctx.getValue()}</span>,
      }),
      column.accessor((row) => row.label || row.email || row.name || row.id || '-', {
        id: 'account',
        header: 'Account',
        cell: (ctx) => (
          <button className="link-cell" onClick={() => onSelect(ctx.row.original)}>
            {ctx.getValue()}
          </button>
        ),
      }),
      column.accessor((row) => statusOf(row), {
        id: 'status',
        header: 'Status',
        cell: (ctx) => <span className={`chip ${ctx.getValue()}`}>{ctx.getValue()}</span>,
      }),
      column.accessor((row) => row.auth_index || row.id || '', {
        id: 'auth',
        header: 'Auth index',
        cell: (ctx) => <span className="mono">{maskSecret(ctx.getValue())}</span>,
      }),
      column.accessor((row) => recentTotals(row.recent_requests), {
        id: 'recent',
        header: 'Recent',
        cell: (ctx) => {
          const value = ctx.getValue();
          return (
            <span className="mini-bars">
              <i style={{ width: `${Math.min(value.success * 5, 80)}px` }} />
              <b style={{ width: `${Math.min(value.failed * 5, 80)}px` }} />
              {value.success}/{value.failed}
            </span>
          );
        },
      }),
      column.display({
        id: 'actions',
        header: '',
        cell: (ctx) => {
          const auth = ctx.row.original;
          return (
            <div className="row-actions">
              <button
                className="icon-button small"
                title={auth.disabled ? 'Enable' : 'Disable'}
                onClick={() => statusMutation.mutate({ auth, disabled: !auth.disabled })}
              >
                {auth.disabled ? <Unlock size={15} /> : <Lock size={15} />}
              </button>
              {auth.name ? (
                <button
                  className="icon-button small"
                  title="Download"
                  onClick={() => void downloadManagementFile(`/v0/management/auth-files/download?name=${encodeURIComponent(auth.name || '')}`, auth.name || 'auth.json')}
                >
                  <Download size={15} />
                </button>
              ) : null}
              <button
                className="icon-button small danger"
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete ${auth.name || auth.id}?`)) deleteMutation.mutate(auth);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        },
      }),
    ],
    [column, deleteMutation, onSelect, statusMutation],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <section className="panel full">
      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Search accounts, providers, auth index" />
        </div>
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
          {providers.map((provider) => (
            <option value={provider} key={provider}>
              {provider}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={Loader2} title="Loading accounts" spin />
                </td>
              </tr>
            ) : null}
            {!loading && table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={KeyRound} title="No accounts match the current filter" />
                </td>
              </tr>
            ) : null}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OAuthActions />
    </section>
  );
}

function OAuthActions() {
  const providers = [
    ['anthropic', 'Claude'],
    ['codex', 'Codex'],
    ['gemini-cli', 'Gemini CLI'],
    ['antigravity', 'Antigravity'],
    ['kimi', 'Kimi'],
    ['xai', 'xAI'],
  ];
  const requestAuth = async (provider: string) => {
    const data = await managementApi.get<{ url?: string }>(`/${provider}-auth-url?is_webui=true`);
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="oauth-row">
      {providers.map(([provider, label]) => (
        <button key={provider} className="secondary" onClick={() => void requestAuth(provider)}>
          <KeyRound size={15} />
          {label} OAuth
        </button>
      ))}
    </div>
  );
}

function ConfigPage({ config }: { config?: AppConfig }) {
  const qc = useQueryClient();
  const yamlQuery = useQuery({ queryKey: ['config-yaml'], queryFn: () => managementApi.get<string>('/config.yaml') });
  const [draft, setDraft] = useState('');
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    if (yamlQuery.data !== undefined) setDraft(yamlQuery.data);
  }, [yamlQuery.data]);

  const saveYaml = useMutation({
    mutationFn: () => managementApi.put('/config.yaml', draft, 'application/yaml; charset=utf-8'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['config'] });
      void qc.invalidateQueries({ queryKey: ['config-yaml'] });
      setShowDiff(false);
    },
  });

  return (
    <div className="config-layout">
      <section className="panel">
        <h2>Common Settings</h2>
        <div className="settings-list">
          <ReadOnlyToggle label="Debug" checked={Boolean(config?.debug)} />
          <ReadOnlyToggle label="Logging to file" checked={Boolean(config?.['logging-to-file'])} />
          <ReadOnlyToggle label="Request log" checked={Boolean(config?.['request-log'])} />
          <ReadOnlyField label="Proxy URL" value={config?.['proxy-url'] || 'direct'} />
          <ReadOnlyField label="Routing strategy" value={config?.routing?.strategy || 'round-robin'} />
          <ReadOnlyField label="Request retry" value={String(config?.['request-retry'] ?? 0)} />
        </div>
      </section>
      <section className="panel editor-panel">
        <div className="panel-heading">
          <div>
            <h2>Advanced YAML</h2>
            <p>Edit the raw config file. Save validates through the server first.</p>
          </div>
          <div className="row-actions">
            <button className="secondary" onClick={() => setShowDiff(!showDiff)}>
              <Eye size={15} />
              Diff
            </button>
            <button className="primary" disabled={saveYaml.isPending || draft === yamlQuery.data} onClick={() => saveYaml.mutate()}>
              {saveYaml.isPending ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
              Save
            </button>
          </div>
        </div>
        {saveYaml.error ? <ApiErrorBox error={saveYaml.error} /> : null}
        {showDiff ? (
          <pre className="diff-view">
            {buildLineDiff(yamlQuery.data || '', draft).map((line, idx) => (
              <span key={`${idx}-${line.type}`} className={line.type}>
                {line.text || ' '}
              </span>
            ))}
          </pre>
        ) : (
          <textarea className="yaml-editor" value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} />
        )}
      </section>
    </div>
  );
}

function ReadOnlyToggle({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <span className={`switch ${checked ? 'on' : ''}`} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
  );
}

function LogsPage({ config }: { config?: AppConfig }) {
  const [after, setAfter] = useState(0);
  const [filter, setFilter] = useState('');
  const qc = useQueryClient();
  const logs = useQuery({
    queryKey: ['logs', after],
    queryFn: () => managementApi.get<LogsResponse>(`/logs?after=${after}&limit=400`),
    refetchInterval: 5000,
    enabled: Boolean(config?.['logging-to-file']),
  });
  const requestErrorLogs = useQuery({
    queryKey: ['request-error-logs'],
    queryFn: () => managementApi.get<{ files: RequestErrorLog[] }>('/request-error-logs'),
  });
  const clearLogs = useMutation({
    mutationFn: () => managementApi.delete('/logs'),
    onSuccess: () => {
      setAfter(0);
      void qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });

  useEffect(() => {
    if (logs.data?.['latest-timestamp']) setAfter(logs.data['latest-timestamp']);
  }, [logs.data]);

  const lines = (logs.data?.lines || []).filter((line) => line.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="logs-layout">
      <section className="panel log-panel">
        <div className="toolbar">
          <div className="search-box">
            <Search size={16} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter logs" />
          </div>
          <button className="secondary" onClick={() => logs.refetch()}>
            <RefreshCcw size={15} />
            Refresh
          </button>
          <button className="danger-button" onClick={() => confirm('Clear all log files?') && clearLogs.mutate()} disabled={!config?.['logging-to-file']}>
            <Trash2 size={15} />
            Clear
          </button>
        </div>
        {!config?.['logging-to-file'] ? <EmptyState icon={FileText} title="File logging is disabled" /> : null}
        {logs.error ? <ApiErrorBox error={logs.error} /> : null}
        <pre className="log-lines">{lines.length ? lines.join('\n') : 'No log lines loaded.'}</pre>
      </section>
      <section className="panel">
        <h2>Request Error Logs</h2>
        <div className="error-file-list">
          {(requestErrorLogs.data?.files || []).map((file) => (
            <button
              key={file.name}
              onClick={() => void downloadManagementFile(`/v0/management/request-error-logs/${encodeURIComponent(file.name)}`, file.name)}
              className="error-file"
            >
              <span className="mono">{file.name}</span>
              <small>
                {bytes(file.size)} · {formatDate(file.modified)}
              </small>
            </button>
          ))}
          {(requestErrorLogs.data?.files || []).length === 0 ? <EmptyState icon={FileText} title="No request error logs" /> : null}
        </div>
      </section>
    </div>
  );
}

function Playground({ accounts }: { accounts: AuthFile[] }) {
  const [authIndex, setAuthIndex] = useState('');
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://api.openai.com/v1/models');
  const [headers, setHeaders] = useState('{\n  "Authorization": "Bearer $TOKEN$"\n}');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<ApiCallResponse | null>(null);
  const call = useMutation({
    mutationFn: async () => {
      let parsedHeaders: Record<string, string> = {};
      if (headers.trim()) parsedHeaders = JSON.parse(headers);
      return managementApi.post<ApiCallResponse>('/api-call', {
        auth_index: authIndex || undefined,
        method,
        url,
        header: parsedHeaders,
        data: body,
      });
    },
    onSuccess: setResult,
  });

  return (
    <div className="playground-layout">
      <section className="panel">
        <h2>Request</h2>
        <div className="form-grid">
          <label>
            Auth
            <select value={authIndex} onChange={(event) => setAuthIndex(event.target.value)}>
              <option value="">No credential substitution</option>
              {accounts.map((auth) => (
                <option key={auth.auth_index || auth.id || auth.name} value={auth.auth_index || ''}>
                  {providerOf(auth)} · {auth.label || auth.email || auth.name || auth.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="span-2">
            URL
            <input value={url} onChange={(event) => setUrl(event.target.value)} />
          </label>
          <label className="span-2">
            Headers JSON
            <textarea value={headers} onChange={(event) => setHeaders(event.target.value)} spellCheck={false} />
          </label>
          <label className="span-2">
            Body
            <textarea value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} />
          </label>
        </div>
        {call.error ? <ApiErrorBox error={call.error} /> : null}
        <button className="primary" onClick={() => call.mutate()} disabled={call.isPending}>
          {call.isPending ? <Loader2 className="spin" size={15} /> : <Play size={15} />}
          Send request
        </button>
      </section>
      <section className="panel result-panel">
        <h2>Response</h2>
        {result ? (
          <>
            <div className="response-status">
              <span className={`chip ${result.status_code >= 400 ? 'failed' : 'available'}`}>{result.status_code}</span>
            </div>
            <pre>{result.body || JSON.stringify(result.header, null, 2)}</pre>
          </>
        ) : (
          <EmptyState icon={Code2} title="No request sent yet" />
        )}
      </section>
    </div>
  );
}

function AccountDrawer({ auth, onClose }: { auth: AuthFile | null; onClose: () => void }) {
  return (
    <aside className={`drawer ${auth ? 'open' : ''}`}>
      <div className="drawer-head">
        <div>
          <h2>{auth?.label || auth?.email || auth?.name || 'Account'}</h2>
          <span className="mono">{auth ? providerOf(auth) : ''}</span>
        </div>
        <button className="icon-button" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      {auth ? (
        <div className="drawer-body">
          <KV label="Status" value={statusOf(auth)} />
          <KV label="Auth index" value={maskSecret(auth.auth_index || auth.id)} />
          <KV label="Email" value={auth.email || '-'} />
          <KV label="Project" value={auth.project_id || '-'} />
          <KV label="Source" value={auth.source || '-'} />
          <KV label="Path" value={auth.path ? maskSecret(auth.path) : '-'} />
          <KV label="Updated" value={formatDate(auth.updated_at || auth.modtime)} />
          <KV label="Last refresh" value={formatDate(auth.last_refresh)} />
          <KV label="Success" value={String(auth.success ?? 0)} />
          <KV label="Failed" value={String(auth.failed ?? 0)} />
          <pre>{JSON.stringify(auth.id_token || {}, null, 2)}</pre>
        </div>
      ) : null}
    </aside>
  );
}

function EmptyState({ icon: Icon, title, spin }: { icon: typeof Activity; title: string; spin?: boolean }) {
  return (
    <div className="empty">
      <Icon className={spin ? 'spin' : ''} size={22} />
      <span>{title}</span>
    </div>
  );
}

function ApiErrorBox({ error }: { error: unknown }) {
  const message = error instanceof ApiError || error instanceof Error ? error.message : 'Request failed';
  return (
    <div className="api-error">
      <AlertTriangle size={16} />
      {message}
    </div>
  );
}
