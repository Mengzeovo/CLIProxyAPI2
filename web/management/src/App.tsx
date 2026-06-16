import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Hash,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  Moon,
  Play,
  Plus,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from '@tanstack/react-table';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  MANAGEMENT_LOCK_EVENT,
  getHealth,
  getManagementKey,
  apiDownload,
  apiUpload,
  managementApi,
  setManagementKey,
  clearManagementKey,
} from './api';
import type {
  ApiCallResponse,
  ApiKeysResponse,
  AppConfig,
  AuthFile,
  AuthFilesResponse,
  AuthUploadResponse,
  LogsResponse,
  ModelAlias,
  OpenAICompatibilityConfig,
  ProviderApiKeyConfig,
  ProviderApiKeyResponse,
  RequestErrorLog,
} from './types';
import { buildLineDiff, bytes, formatDate, generateApiKey, maskSecret, mergeBuckets, providerOf, recentTotals, statusOf, successRate } from './utils';
import {
  getInitialLanguage,
  languageOptions,
  persistLanguage,
  statusTranslationKey,
  translate,
  type Language,
  type TranslationKey,
} from './i18n';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type View = 'overview' | 'accounts' | 'apikeys' | 'config' | 'logs' | 'playground';

const navItems: Array<{ id: View; labelKey: TranslationKey; icon: typeof Activity }> = [
  { id: 'overview', labelKey: 'navOverview', icon: Activity },
  { id: 'accounts', labelKey: 'accounts', icon: KeyRound },
  { id: 'apikeys', labelKey: 'navApiKeys', icon: Hash },
  { id: 'config', labelKey: 'config', icon: Settings },
  { id: 'logs', labelKey: 'logs', icon: FileText },
  { id: 'playground', labelKey: 'navApiTest', icon: Play },
];

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

type CredentialTab = 'oauth' | 'upload' | 'api-key';
type UploadMode = 'auth-json' | 'vertex';
type ApiKeyProvider = 'gemini' | 'claude' | 'codex' | 'openai-compatibility' | 'vertex';

const apiKeyEndpointByProvider: Record<ApiKeyProvider, string> = {
  gemini: '/gemini-api-key',
  claude: '/claude-api-key',
  codex: '/codex-api-key',
  'openai-compatibility': '/openai-compatibility',
  vertex: '/vertex-api-key',
};

const apiKeyResponseKeyByProvider: Record<ApiKeyProvider, keyof ProviderApiKeyResponse> = {
  gemini: 'gemini-api-key',
  claude: 'claude-api-key',
  codex: 'codex-api-key',
  'openai-compatibility': 'openai-compatibility',
  vertex: 'vertex-api-key',
};

const apiKeyProviderLabels: Array<{ value: ApiKeyProvider; label: string }> = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'openai-compatibility', label: 'OpenAI-compatible' },
  { value: 'vertex', label: 'Vertex-compatible' },
];

type ApiKeyFormState = {
  provider: ApiKeyProvider;
  name: string;
  apiKey: string;
  baseUrl: string;
  prefix: string;
  proxyUrl: string;
  priority: string;
  headersJson: string;
  modelsJson: string;
  excludedModelsJson: string;
  websockets: boolean;
};

const defaultApiKeyForm: ApiKeyFormState = {
  provider: 'gemini',
  name: '',
  apiKey: '',
  baseUrl: '',
  prefix: '',
  proxyUrl: '',
  priority: '',
  headersJson: '',
  modelsJson: '',
  excludedModelsJson: '',
  websockets: false,
};

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: TFunction;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nContext.Provider');
  }
  return value;
}

function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const t = useCallback<TFunction>((key, params) => translate(language, key, params), [language]);

  useEffect(() => {
    persistLanguage(language);
    document.documentElement.lang = language;
    document.title = t('appTitle');
  }, [language, t]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

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
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <ManagementApp />
      </QueryClientProvider>
    </I18nProvider>
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

function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-select" title={t('languageSelect')}>
      <Languages size={15} />
      <select aria-label={t('language')} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {languageOptions.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AuthGate({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t('unableToUnlock'));
    },
  });

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-actions">
          <LanguageSelect />
        </div>
        <div className="auth-mark">
          <Shield size={28} />
        </div>
        <h1>{t('appTitle')}</h1>
        <p>{t('managementKeyHelp')}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!key.trim()) {
              setError(t('managementKeyRequired'));
              return;
            }
            testKey.mutate();
          }}
        >
          <input name="username" type="hidden" autoComplete="username" value="management" readOnly />
          <label htmlFor="management-key">{t('managementKey')}</label>
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
            {t('unlock')}
          </button>
        </form>
      </section>
    </main>
  );
}

function ConsoleShell({ onLock }: { onLock: () => void }) {
  const { t } = useI18n();
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

  const accounts = authFiles.data?.files || [];
  const activeView = navItems.find((item) => item.id === view);
  const activeViewLabel = activeView ? t(activeView.labelKey) : '';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">CP</div>
          <div>
            <strong>CLIProxyAPI</strong>
            <span>{t('management')}</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>
                <Icon size={17} />
                {t(item.labelKey)}
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
          {t('lockSession')}
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="crumb">
              {t('management')} <ChevronRight size={14} /> {activeViewLabel}
            </div>
            <h1>{activeViewLabel}</h1>
          </div>
          <div className="top-actions">
            <StatusPill ok={health.data?.status === 'ok'} label={health.data?.status === 'ok' ? t('serviceOnline') : t('healthPending')} />
            <LanguageSelect />
            <button className="icon-button" title={t('refresh')} onClick={() => qc.invalidateQueries()}>
              <RefreshCcw size={17} />
            </button>
            <button className="icon-button" title={t('themeToggle')} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        <section className="content">
          {view === 'overview' ? (
            <Overview config={config.data} accounts={accounts} loading={config.isLoading || authFiles.isLoading} />
          ) : null}
          {view === 'accounts' ? <Accounts accounts={accounts} loading={authFiles.isLoading} onSelect={setSelectedAuth} /> : null}
          {view === 'apikeys' ? <ApiKeys /> : null}
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

function Overview({ config, accounts, loading }: { config?: AppConfig; accounts: AuthFile[]; loading: boolean }) {
  const { t } = useI18n();
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

  // auth.success / auth.failed are lifetime totals that already include the
  // counts surfaced in recent_requests, so we must not add recentTotals here
  // or recent activity would be double counted.
  const totals = useMemo(
    () =>
      accounts.reduce<{ success: number; failed: number }>(
        (acc, auth) => {
          acc.success += Number(auth.success ?? 0);
          acc.failed += Number(auth.failed ?? 0);
          return acc;
        },
        { success: 0, failed: 0 },
      ),
    [accounts],
  );
  const overallRate = successRate(accounts);

  const trendBuckets = useMemo(
    () => mergeBuckets(accounts.map((auth) => auth.recent_requests)),
    [accounts],
  );

  return (
    <div className="page-grid">
      <div className="metric-row">
        <Metric icon={Server} label={t('service')} value={loading ? t('loading') : t('online')} tone="green" />
        <Metric icon={KeyRound} label={t('accounts')} value={`${enabled}/${accounts.length}`} detail={t('enabledTotal')} tone="blue" />
        <Metric icon={CheckCircle2} label={t('totalSuccess')} value={String(totals.success)} detail={`${overallRate}% ${t('success')}`} tone="green" />
        <Metric icon={AlertTriangle} label={t('totalFailed')} value={String(totals.failed)} tone={totals.failed > 0 ? 'red' : 'green'} />
      </div>

      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <h2>{t('usageTrend')}</h2>
            <p>{t('usageTrendHelp')}</p>
          </div>
        </div>
        <UsageTrend buckets={trendBuckets} emptyLabel={t('noAccountsFound')} />
      </section>

      <section className="panel wide">
        <div className="panel-heading">
          <div>
            <h2>{t('providerHealthMatrix')}</h2>
            <p>{t('providerHealthMatrixHelp')}</p>
          </div>
        </div>
        <div className="matrix matrix-usage">
          <div className="matrix-head">
            <span>{t('provider')}</span>
            <span>{t('total')}</span>
            <span>{t('enabled')}</span>
            <span>{t('unavailable')}</span>
            <span>{t('recentSuccess')}</span>
            <span>{t('recentFailed')}</span>
            <span>{t('success')}</span>
          </div>
          {byProvider.length === 0 ? <EmptyState icon={KeyRound} title={t('noAccountsFound')} /> : null}
          {byProvider.map(([provider, providerAccounts]) => {
            const disabled = providerAccounts.filter((auth) => auth.disabled).length;
            const failed = providerAccounts.filter((auth) => auth.unavailable || statusOf(auth) === 'failed').length;
            const recent = providerAccounts.reduce<{ success: number; failed: number }>(
              (acc, auth) => {
                const r = recentTotals(auth.recent_requests);
                acc.success += r.success;
                acc.failed += r.failed;
                return acc;
              },
              { success: 0, failed: 0 },
            );
            return (
              <div className="matrix-row" key={provider}>
                <span className="mono">{provider}</span>
                <span>{providerAccounts.length}</span>
                <span>{providerAccounts.length - disabled}</span>
                <span>{failed}</span>
                <span className="pos">{recent.success}</span>
                <span className="neg">{recent.failed}</span>
                <span>{successRate(providerAccounts)}%</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>{t('configuration')}</h2>
        <div className="kv-list">
          <KV label={t('debug')} value={t(Boolean(config?.debug) ? 'yes' : 'no')} />
          <KV label={t('loggingToFile')} value={t(Boolean(config?.['logging-to-file']) ? 'yes' : 'no')} />
          <KV label={t('requestLog')} value={t(Boolean(config?.['request-log']) ? 'yes' : 'no')} />
          <KV label={t('proxyUrl')} value={config?.['proxy-url'] ? t('configured') : t('direct')} />
          <KV label={t('routing')} value={config?.routing?.strategy || 'round-robin'} />
          <KV label={t('retry')} value={String(config?.['request-retry'] ?? 0)} />
        </div>
      </section>

      <section className="panel">
        <h2>{t('managementApi')}</h2>
        <div className="kv-list">
          <KV label={t('panelMode')} value={config?.['remote-management']?.['panel-mode'] || 'builtin'} />
          <KV label={t('remoteAccess')} value={t(Boolean(config?.['remote-management']?.['allow-remote']) ? 'yes' : 'no')} />
          <KV label={t('controlPanel')} value={config?.['remote-management']?.['disable-control-panel'] ? t('disabled') : t('enabled')} />
        </div>
      </section>
    </div>
  );
}

function UsageTrend({ buckets, emptyLabel }: { buckets: Array<{ label: string; success: number; failed: number }>; emptyLabel: string }) {
  const { t } = useI18n();
  const max = buckets.reduce((acc, bucket) => Math.max(acc, bucket.success + bucket.failed), 0);
  const hasData = buckets.some((bucket) => bucket.success + bucket.failed > 0);

  if (buckets.length === 0 || !hasData) {
    return <EmptyState icon={Activity} title={emptyLabel} />;
  }

  return (
    <div className="usage-trend">
      <div className="usage-trend-bars">
        {buckets.map((bucket, index) => {
          const total = bucket.success + bucket.failed;
          const heightPct = max > 0 ? Math.round((total / max) * 100) : 0;
          const successPct = total > 0 ? Math.round((bucket.success / total) * 100) : 0;
          const title = `${bucket.label || ''} · ${t('success')} ${bucket.success} / ${t('failed')} ${bucket.failed}`;
          return (
            <div className="usage-trend-col" key={index} title={title}>
              <div className="usage-trend-stack" style={{ height: `${heightPct}%` }}>
                <i className="usage-bar fail" style={{ height: `${100 - successPct}%` }} />
                <i className="usage-bar ok" style={{ height: `${successPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="usage-trend-legend">
        <span><i className="usage-dot ok" />{t('success')}</span>
        <span><i className="usage-dot fail" />{t('failed')}</span>
      </div>
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
  const { t } = useI18n();
  const [globalFilter, setGlobalFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [addCredentialOpen, setAddCredentialOpen] = useState(false);
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
  const formatStatus = useCallback((status: string) => t(statusTranslationKey(status)), [t]);
  const columns = useMemo(
    () => [
      column.accessor((row) => providerOf(row), {
        id: 'provider',
        header: t('provider'),
        cell: (ctx) => <span className="chip neutral mono">{ctx.getValue()}</span>,
      }),
      column.accessor((row) => row.label || row.email || row.name || row.id || '-', {
        id: 'account',
        header: t('account'),
        cell: (ctx) => (
          <button className="link-cell" onClick={() => onSelect(ctx.row.original)}>
            {ctx.getValue()}
          </button>
        ),
      }),
      column.accessor((row) => statusOf(row), {
        id: 'status',
        header: t('status'),
        cell: (ctx) => <span className={`chip ${ctx.getValue()}`}>{formatStatus(ctx.getValue())}</span>,
      }),
      column.accessor((row) => row.auth_index || row.id || '', {
        id: 'auth',
        header: t('authIndex'),
        cell: (ctx) => <span className="mono">{maskSecret(ctx.getValue())}</span>,
      }),
      column.accessor((row) => recentTotals(row.recent_requests), {
        id: 'recent',
        header: t('recent'),
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
                title={auth.disabled ? t('enable') : t('disable')}
                onClick={() => statusMutation.mutate({ auth, disabled: !auth.disabled })}
              >
                {auth.disabled ? <Unlock size={15} /> : <Lock size={15} />}
              </button>
              {auth.name ? (
                <button
                  className="icon-button small"
                  title={t('download')}
                  onClick={() => void downloadManagementFile(`/v0/management/auth-files/download?name=${encodeURIComponent(auth.name || '')}`, auth.name || 'auth.json')}
                >
                  <Download size={15} />
                </button>
              ) : null}
              <button
                className="icon-button small danger"
                title={t('delete')}
                onClick={() => {
                  if (confirm(t('deleteConfirm', { name: auth.name || auth.id || '-' }))) deleteMutation.mutate(auth);
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        },
      }),
    ],
    [column, deleteMutation, formatStatus, onSelect, statusMutation, t],
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
          <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder={t('searchAccounts')} />
        </div>
        <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
          {providers.map((provider) => (
            <option value={provider} key={provider}>
              {provider === 'all' ? t('all') : provider}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => setAddCredentialOpen(true)}>
          <Plus size={15} />
          {t('addCredential')}
        </button>
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
                  <EmptyState icon={Loader2} title={t('loadingAccounts')} spin />
                </td>
              </tr>
            ) : null}
            {!loading && table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={KeyRound} title={t('noAccountsFilter')} />
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
      <AddCredentialModal open={addCredentialOpen} onClose={() => setAddCredentialOpen(false)} />
    </section>
  );
}

function OAuthActions({ onRequested }: { onRequested?: () => void }) {
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
    if (data.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer');
      onRequested?.();
    }
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

function AddCredentialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<CredentialTab>('oauth');
  const qc = useQueryClient();

  const refreshCredentialQueries = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['auth-files'] });
    void qc.invalidateQueries({ queryKey: ['config'] });
    void qc.invalidateQueries({ queryKey: ['config-yaml'] });
  }, [qc]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-credential-title">
        <div className="modal-head">
          <div>
            <h2 id="add-credential-title">{t('addCredential')}</h2>
            <p>{t('addCredentialHelp')}</p>
          </div>
          <button className="icon-button" title={t('close')} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="segmented" role="tablist" aria-label={t('credentialType')}>
          {[
            ['oauth', t('oauthLogin')],
            ['upload', t('uploadFile')],
            ['api-key', t('apiKey')],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id as CredentialTab)} type="button">
              {label}
            </button>
          ))}
        </div>
        <div className="modal-body">
          {tab === 'oauth' ? (
            <CredentialSection title={t('oauthLogin')}>
              <OAuthActions
                onRequested={() => {
                  refreshCredentialQueries();
                  onClose();
                }}
              />
            </CredentialSection>
          ) : null}
          {tab === 'upload' ? <UploadCredentialPanel onSuccess={refreshCredentialQueries} /> : null}
          {tab === 'api-key' ? <ApiKeyCredentialPanel onSuccess={refreshCredentialQueries} /> : null}
        </div>
      </section>
    </div>
  );
}

function CredentialSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="credential-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function UploadCredentialPanel({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<UploadMode>('auth-json');
  const [authFiles, setAuthFiles] = useState<File[]>([]);
  const [vertexFile, setVertexFile] = useState<File | null>(null);
  const [vertexLocation, setVertexLocation] = useState('us-central1');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileInputResetKey, setFileInputResetKey] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setError('');
      setSuccess('');
      if (mode === 'auth-json') {
        if (authFiles.length === 0) throw new Error(t('noFileSelected'));
        if (authFiles.some((file) => !file.name.toLowerCase().endsWith('.json'))) throw new Error(t('onlyJsonFiles'));
        const formData = new FormData();
        for (const file of authFiles) {
          formData.append('file', file);
        }
        return apiUpload<AuthUploadResponse>('/v0/management/auth-files', formData);
      }
      if (!vertexFile) throw new Error(t('noFileSelected'));
      if (!vertexFile.name.toLowerCase().endsWith('.json')) throw new Error(t('onlyJsonFiles'));
      const formData = new FormData();
      formData.append('file', vertexFile);
      formData.append('location', vertexLocation.trim() || 'us-central1');
      return apiUpload<AuthUploadResponse>('/v0/management/vertex/import', formData);
    },
    onSuccess: () => {
      setSuccess(mode === 'auth-json' ? t('uploadSuccess') : t('vertexUploadSuccess'));
      setAuthFiles([]);
      setVertexFile(null);
      setFileInputResetKey((value) => value + 1);
      onSuccess();
    },
    onError: (err) => setError(err instanceof Error ? err.message : t('apiRequestFailed')),
  });

  return (
    <CredentialSection title={t('uploadFile')}>
      <div className="segmented compact" role="tablist" aria-label={t('uploadFile')}>
        <button type="button" className={mode === 'auth-json' ? 'active' : ''} onClick={() => setMode('auth-json')}>
          {t('uploadAuthJson')}
        </button>
        <button type="button" className={mode === 'vertex' ? 'active' : ''} onClick={() => setMode('vertex')}>
          {t('vertexServiceAccount')}
        </button>
      </div>
      {mode === 'auth-json' ? (
        <div className="form-grid">
          <label className="span-2">
            {t('authJsonFiles')}
            <input
              key={`auth-json-${fileInputResetKey}`}
              type="file"
              accept=".json,application/json"
              multiple
              onChange={(event) => setAuthFiles(Array.from(event.target.files || []))}
            />
          </label>
          <p className="field-help span-2">{t('authJsonUploadHelp')}</p>
        </div>
      ) : (
        <div className="form-grid">
          <label className="span-2">
            {t('vertexServiceAccount')}
            <input
              key={`vertex-${fileInputResetKey}`}
              type="file"
              accept=".json,application/json"
              onChange={(event) => setVertexFile(event.target.files?.[0] || null)}
            />
          </label>
          <label>
            {t('vertexLocation')}
            <input value={vertexLocation} onChange={(event) => setVertexLocation(event.target.value)} />
          </label>
        </div>
      )}
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}
      <button className="primary" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
        {uploadMutation.isPending ? <Loader2 className="spin" size={15} /> : <FileUp size={15} />}
        {mode === 'auth-json' ? t('upload') : t('importVertex')}
      </button>
    </CredentialSection>
  );
}

function ApiKeyCredentialPanel({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<ApiKeyFormState>(defaultApiKeyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateForm = <K extends keyof ApiKeyFormState>(key: K, value: ApiKeyFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => saveApiKeyCredential(form, t),
    onSuccess: () => {
      setSuccess(t('apiKeySaved'));
      setError('');
      setForm(defaultApiKeyForm);
      onSuccess();
    },
    onError: (err) => {
      setSuccess('');
      setError(err instanceof Error ? err.message : t('apiRequestFailed'));
    },
  });

  const isOpenAICompat = form.provider === 'openai-compatibility';

  return (
    <CredentialSection title={t('addApiKey')}>
      <div className="form-grid">
        <label>
          {t('apiKeyProvider')}
          <select value={form.provider} onChange={(event) => updateForm('provider', event.target.value as ApiKeyProvider)}>
            {apiKeyProviderLabels.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
        {isOpenAICompat ? (
          <label>
            {t('name')}
            <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
          </label>
        ) : null}
        <label className={isOpenAICompat ? '' : 'span-2'}>
          {t('apiKey')}
          <input type="password" value={form.apiKey} onChange={(event) => updateForm('apiKey', event.target.value)} />
        </label>
        <label>
          Base URL
          <input value={form.baseUrl} onChange={(event) => updateForm('baseUrl', event.target.value)} />
        </label>
        <label>
          Prefix
          <input value={form.prefix} onChange={(event) => updateForm('prefix', event.target.value)} />
        </label>
        <label>
          {t('proxyUrl')}
          <input value={form.proxyUrl} onChange={(event) => updateForm('proxyUrl', event.target.value)} />
        </label>
        <label>
          {t('priority')}
          <input type="number" value={form.priority} onChange={(event) => updateForm('priority', event.target.value)} />
        </label>
        {form.provider === 'codex' ? (
          <label className="checkbox-row span-2">
            <input type="checkbox" checked={form.websockets} onChange={(event) => updateForm('websockets', event.target.checked)} />
            {t('codexWebsockets')}
          </label>
        ) : null}
        <label className="span-2">
          {t('headersJson')}
          <textarea value={form.headersJson} onChange={(event) => updateForm('headersJson', event.target.value)} spellCheck={false} />
        </label>
        <label className="span-2">
          {t('modelsJson')}
          <textarea value={form.modelsJson} onChange={(event) => updateForm('modelsJson', event.target.value)} spellCheck={false} />
        </label>
        <label className="span-2">
          {t('excludedModelsJson')}
          <textarea value={form.excludedModelsJson} onChange={(event) => updateForm('excludedModelsJson', event.target.value)} spellCheck={false} />
        </label>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}
      <button className="primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
        {t('addApiKey')}
      </button>
    </CredentialSection>
  );
}

async function saveApiKeyCredential(form: ApiKeyFormState, t: TFunction): Promise<void> {
  const provider = form.provider;
  const endpoint = apiKeyEndpointByProvider[provider];
  const responseKey = apiKeyResponseKeyByProvider[provider];
  const apiKey = form.apiKey.trim();
  const baseUrl = form.baseUrl.trim();
  const providerName = form.name.trim();

  if (provider === 'openai-compatibility') {
    if (!providerName) throw new Error(t('providerNameRequired'));
    if (!baseUrl) throw new Error(t('baseUrlRequired'));
  } else if (!apiKey) {
    throw new Error(t('apiKeyRequired'));
  }
  if (provider === 'codex' && !baseUrl) {
    throw new Error(t('baseUrlRequired'));
  }

  const priority = parseOptionalInteger(form.priority);
  const headers = parseOptionalJSONObject(form.headersJson, t('headersJson'), t);
  const models = parseOptionalJSONArray<ModelAlias>(form.modelsJson, t('modelsJson'), t);
  const excludedModels = parseOptionalJSONArray<string>(form.excludedModelsJson, 'excluded-models', t);

  const current = await managementApi.get<ProviderApiKeyResponse>(endpoint);
  const currentList = (current[responseKey] || []) as Array<ProviderApiKeyConfig | OpenAICompatibilityConfig>;

  if (provider === 'openai-compatibility') {
    const entry: OpenAICompatibilityConfig = {
      name: providerName,
      'base-url': baseUrl,
    };
    if (priority !== undefined) entry.priority = priority;
    if (form.prefix.trim()) entry.prefix = form.prefix.trim();
    if (apiKey) entry['api-key-entries'] = [{ 'api-key': apiKey, ...(form.proxyUrl.trim() ? { 'proxy-url': form.proxyUrl.trim() } : {}) }];
    if (models) entry.models = models;
    if (headers) entry.headers = headers;
    await managementApi.put(endpoint, [...(currentList as OpenAICompatibilityConfig[]), entry]);
    return;
  }

  const entry: ProviderApiKeyConfig = {
    'api-key': apiKey,
  };
  if (priority !== undefined) entry.priority = priority;
  if (form.prefix.trim()) entry.prefix = form.prefix.trim();
  if (baseUrl) entry['base-url'] = baseUrl;
  if (form.proxyUrl.trim()) entry['proxy-url'] = form.proxyUrl.trim();
  if (models) entry.models = models;
  if (headers) entry.headers = headers;
  if (excludedModels) entry['excluded-models'] = excludedModels;
  if (provider === 'codex' && form.websockets) entry.websockets = true;

  await managementApi.put(endpoint, [...(currentList as ProviderApiKeyConfig[]), entry]);
}

function parseOptionalInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalJSON(value: string, field: string, t: TFunction): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(t('invalidJsonValue', { field }));
  }
}

function parseOptionalJSONObject(value: string, field: string, t: TFunction): Record<string, string> | undefined {
  const parsed = parseOptionalJSON(value, field, t);
  if (parsed === undefined) return undefined;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(t('invalidJsonObject', { field }));
  }
  return parsed as Record<string, string>;
}

function parseOptionalJSONArray<T>(value: string, field: string, t: TFunction): T[] | undefined {
  const parsed = parseOptionalJSON(value, field, t);
  if (parsed === undefined) return undefined;
  if (!Array.isArray(parsed)) {
    throw new Error(t('invalidJsonArray', { field }));
  }
  return parsed as T[];
}

function ConfigPage({ config }: { config?: AppConfig }) {
  const { t } = useI18n();
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
        <h2>{t('commonSettings')}</h2>
        <div className="settings-list">
          <ReadOnlyToggle label={t('debug')} checked={Boolean(config?.debug)} />
          <ReadOnlyToggle label={t('loggingToFile')} checked={Boolean(config?.['logging-to-file'])} />
          <ReadOnlyToggle label={t('requestLog')} checked={Boolean(config?.['request-log'])} />
          <ReadOnlyField label={t('proxyUrl')} value={config?.['proxy-url'] || t('direct')} />
          <ReadOnlyField label={t('routingStrategy')} value={config?.routing?.strategy || 'round-robin'} />
          <ReadOnlyField label={t('requestRetry')} value={String(config?.['request-retry'] ?? 0)} />
        </div>
      </section>
      <section className="panel editor-panel">
        <div className="panel-heading">
          <div>
            <h2>{t('advancedYaml')}</h2>
            <p>{t('advancedYamlHelp')}</p>
          </div>
          <div className="row-actions">
            <button className="secondary" onClick={() => setShowDiff(!showDiff)}>
              <Eye size={15} />
              {t('diff')}
            </button>
            <button className="primary" disabled={saveYaml.isPending || draft === yamlQuery.data} onClick={() => saveYaml.mutate()}>
              {saveYaml.isPending ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
              {t('save')}
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
  const { t } = useI18n();
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
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t('filterLogs')} />
          </div>
          <button className="secondary" onClick={() => logs.refetch()}>
            <RefreshCcw size={15} />
            {t('refresh')}
          </button>
          <button className="danger-button" onClick={() => confirm(t('clearAllLogFiles')) && clearLogs.mutate()} disabled={!config?.['logging-to-file']}>
            <Trash2 size={15} />
            {t('clear')}
          </button>
        </div>
        {!config?.['logging-to-file'] ? <EmptyState icon={FileText} title={t('fileLoggingDisabled')} /> : null}
        {logs.error ? <ApiErrorBox error={logs.error} /> : null}
        <pre className="log-lines">{lines.length ? lines.join('\n') : t('noLogLines')}</pre>
      </section>
      <section className="panel">
        <h2>{t('requestErrorLogs')}</h2>
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
          {(requestErrorLogs.data?.files || []).length === 0 ? <EmptyState icon={FileText} title={t('noRequestErrorLogs')} /> : null}
        </div>
      </section>
    </div>
  );
}

function Playground({ accounts }: { accounts: AuthFile[] }) {
  const { t } = useI18n();
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
        <h2>{t('request')}</h2>
        <div className="form-grid">
          <label>
            {t('auth')}
            <select value={authIndex} onChange={(event) => setAuthIndex(event.target.value)}>
              <option value="">{t('noCredentialSubstitution')}</option>
              {accounts.map((auth) => (
                <option key={auth.auth_index || auth.id || auth.name} value={auth.auth_index || ''}>
                  {providerOf(auth)} · {auth.label || auth.email || auth.name || auth.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('method')}
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="span-2">
            {t('url')}
            <input value={url} onChange={(event) => setUrl(event.target.value)} />
          </label>
          <label className="span-2">
            {t('headersJson')}
            <textarea value={headers} onChange={(event) => setHeaders(event.target.value)} spellCheck={false} />
          </label>
          <label className="span-2">
            {t('body')}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} />
          </label>
        </div>
        {call.error ? <ApiErrorBox error={call.error} /> : null}
        <button className="primary" onClick={() => call.mutate()} disabled={call.isPending}>
          {call.isPending ? <Loader2 className="spin" size={15} /> : <Play size={15} />}
          {t('sendRequest')}
        </button>
      </section>
      <section className="panel result-panel">
        <h2>{t('response')}</h2>
        {result ? (
          <>
            <div className="response-status">
              <span className={`chip ${result.status_code >= 400 ? 'failed' : 'available'}`}>{result.status_code}</span>
            </div>
            <pre>{result.body || JSON.stringify(result.header, null, 2)}</pre>
          </>
        ) : (
          <EmptyState icon={Code2} title={t('noRequestSent')} />
        )}
      </section>
    </div>
  );
}

function ApiKeyRow({
  value,
  onUpdate,
  onDelete,
  busy,
}: {
  value: string;
  onUpdate: (next: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(value).then(() => setCopied(true));
  }, [value]);

  return (
    <div className="apikey-row">
      {editing ? (
        <input className="apikey-input" value={draft} autoFocus spellCheck={false} onChange={(event) => setDraft(event.target.value)} />
      ) : (
        <span className="mono apikey-value">{revealed ? value : maskSecret(value)}</span>
      )}
      <div className="row-actions">
        {editing ? (
          <>
            <button
              className="icon-button small"
              title={t('save')}
              disabled={busy || !draft.trim() || draft.trim() === value}
              onClick={() => {
                onUpdate(draft.trim());
                setEditing(false);
              }}
            >
              <Save size={15} />
            </button>
            <button
              className="icon-button small"
              title={t('close')}
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
            >
              <X size={15} />
            </button>
          </>
        ) : (
          <>
            <button className="icon-button small" title={revealed ? t('hide') : t('show')} onClick={() => setRevealed((prev) => !prev)}>
              {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button className="icon-button small" title={copied ? t('copied') : t('copy')} onClick={copy}>
              {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
            </button>
            <button className="icon-button small" title={t('edit')} disabled={busy} onClick={() => setEditing(true)}>
              <Pencil size={15} />
            </button>
            <button
              className="icon-button small danger"
              title={t('delete')}
              disabled={busy}
              onClick={() => {
                if (confirm(t('apiKeyDeleteConfirm'))) onDelete();
              }}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ApiKeys() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => managementApi.get<ApiKeysResponse>('/api-keys'),
  });
  const keys = useMemo(() => query.data?.['api-keys'] || [], [query.data]);

  const save = useMutation({
    mutationFn: (next: string[]) => managementApi.put('/api-keys', { 'api-keys': next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const addKey = useCallback(() => {
    const trimmed = newKey.trim();
    setError('');
    setNotice('');
    if (!trimmed) {
      setError(t('apiKeyValueRequired'));
      return;
    }
    if (keys.includes(trimmed)) {
      setError(t('apiKeyDuplicate'));
      return;
    }
    save.mutate([...keys, trimmed], {
      onSuccess: () => {
        setNewKey('');
        setNotice(t('apiKeyAdded'));
      },
    });
  }, [keys, newKey, save, t]);

  const generateKey = useCallback(() => {
    setError('');
    setNotice('');
    let candidate = generateApiKey();
    while (keys.includes(candidate)) {
      candidate = generateApiKey();
    }
    setNewKey(candidate);
    void navigator.clipboard?.writeText(candidate).then(
      () => setNotice(t('apiKeyGeneratedCopied')),
      () => setNotice(t('apiKeyGenerated')),
    );
  }, [keys, t]);

  const updateKey = useCallback(
    (index: number, next: string) => {
      setError('');
      setNotice('');
      if (keys.includes(next) && keys[index] !== next) {
        setError(t('apiKeyDuplicate'));
        return;
      }
      const updated = keys.map((key, i) => (i === index ? next : key));
      save.mutate(updated, { onSuccess: () => setNotice(t('apiKeyUpdated')) });
    },
    [keys, save, t],
  );

  const deleteKey = useCallback(
    (index: number) => {
      setError('');
      setNotice('');
      const updated = keys.filter((_, i) => i !== index);
      save.mutate(updated, { onSuccess: () => setNotice(t('apiKeyDeleted')) });
    },
    [keys, save, t],
  );

  return (
    <section className="panel full">
      <div className="panel-heading">
        <div>
          <h2>{t('clientApiKeys')}</h2>
          <p>{t('clientApiKeysHelp')}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box grow">
          <KeyRound size={16} />
          <input
            value={newKey}
            spellCheck={false}
            placeholder={t('apiKeyValue')}
            onChange={(event) => setNewKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addKey();
            }}
          />
        </div>
        <button className="ghost" type="button" onClick={generateKey}>
          <Sparkles size={15} />
          {t('generateApiKey')}
        </button>
        <button className="primary" disabled={save.isPending} onClick={addKey}>
          {save.isPending ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
          {t('addClientApiKey')}
        </button>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {notice ? <div className="form-success">{notice}</div> : null}
      {save.error ? <ApiErrorBox error={save.error} /> : null}

      {query.isLoading ? (
        <EmptyState icon={Loader2} title={t('loading')} spin />
      ) : keys.length === 0 ? (
        <EmptyState icon={KeyRound} title={t('noApiKeys')} />
      ) : (
        <div className="apikey-list">
          {keys.map((key, index) => (
            <ApiKeyRow
              key={index}
              value={key}
              busy={save.isPending}
              onUpdate={(next) => updateKey(index, next)}
              onDelete={() => deleteKey(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AccountDrawer({ auth, onClose }: { auth: AuthFile | null; onClose: () => void }) {
  const { t } = useI18n();
  const status = auth ? statusOf(auth) : '';

  return (
    <aside className={`drawer ${auth ? 'open' : ''}`}>
      <div className="drawer-head">
        <div>
          <h2>{auth?.label || auth?.email || auth?.name || t('account')}</h2>
          <span className="mono">{auth ? providerOf(auth) : ''}</span>
        </div>
        <button className="icon-button" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      {auth ? (
        <div className="drawer-body">
          <KV label={t('status')} value={t(statusTranslationKey(status))} />
          <KV label={t('authIndex')} value={maskSecret(auth.auth_index || auth.id)} />
          <KV label={t('email')} value={auth.email || '-'} />
          <KV label={t('project')} value={auth.project_id || '-'} />
          <KV label={t('source')} value={auth.source || '-'} />
          <KV label={t('path')} value={auth.path ? maskSecret(auth.path) : '-'} />
          <KV label={t('updated')} value={formatDate(auth.updated_at || auth.modtime)} />
          <KV label={t('lastRefresh')} value={formatDate(auth.last_refresh)} />
          <KV label={t('success')} value={String(auth.success ?? 0)} />
          <KV label={t('failed')} value={String(auth.failed ?? 0)} />
          <div className="drawer-trend">
            <span className="drawer-trend-title">{t('usageTrend')}</span>
            <UsageTrend buckets={mergeBuckets([auth.recent_requests])} emptyLabel={t('noRequestSent')} />
          </div>
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
  const { t } = useI18n();
  const message = error instanceof ApiError || error instanceof Error ? error.message : t('apiRequestFailed');
  return (
    <div className="api-error">
      <AlertTriangle size={16} />
      {message}
    </div>
  );
}
