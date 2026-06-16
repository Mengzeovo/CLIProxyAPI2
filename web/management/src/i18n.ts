export const LANGUAGE_STORAGE = 'cliproxyapi.managementLanguage';

export const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '中文' },
] as const;

export type Language = (typeof languageOptions)[number]['value'];

const en = {
  account: 'Account',
  accounts: 'Accounts',
  advancedYaml: 'Advanced YAML',
  advancedYamlHelp: 'Edit the raw config file. Save validates through the server first.',
  all: 'all',
  apiRequestFailed: 'Request failed',
  appTitle: 'CLIProxyAPI Management',
  auth: 'Auth',
  authIndex: 'Auth index',
  body: 'Body',
  clear: 'Clear',
  clearAllLogFiles: 'Clear all log files?',
  commonSettings: 'Common Settings',
  config: 'Config',
  configuration: 'Configuration',
  configured: 'configured',
  controlPanel: 'Control panel',
  debug: 'Debug',
  delete: 'Delete',
  deleteConfirm: 'Delete {name}?',
  diff: 'Diff',
  direct: 'direct',
  disable: 'Disable',
  disabled: 'disabled',
  download: 'Download',
  email: 'Email',
  enable: 'Enable',
  enabled: 'Enabled',
  enabledTotal: 'enabled / total',
  failed: 'Failed',
  fileLoggingDisabled: 'File logging is disabled',
  filterLogs: 'Filter logs',
  healthPending: 'Health pending',
  headersJson: 'Headers JSON',
  language: 'Language',
  languageSelect: 'Select language',
  lastRefresh: 'Last refresh',
  loading: 'Loading',
  loadingAccounts: 'Loading accounts',
  lockSession: 'Lock session',
  loggingToFile: 'Logging to file',
  logs: 'Logs',
  management: 'Management',
  managementApi: 'Management API',
  managementKey: 'Management key',
  managementKeyHelp: 'Enter the management key for this browser session.',
  managementKeyRequired: 'Management key is required',
  method: 'Method',
  navApiTest: 'API Test',
  navOverview: 'Overview',
  noAccountsFilter: 'No accounts match the current filter',
  noAccountsFound: 'No accounts found',
  noCredentialSubstitution: 'No credential substitution',
  noLogLines: 'No log lines loaded.',
  noRequestErrorLogs: 'No request error logs',
  noRequestSent: 'No request sent yet',
  online: 'Online',
  panelMode: 'Panel mode',
  path: 'Path',
  project: 'Project',
  provider: 'Provider',
  providerHealthMatrix: 'Provider Health Matrix',
  providerHealthMatrixHelp: 'Account availability and recent request success by provider.',
  proxyUrl: 'Proxy URL',
  recent: 'Recent',
  recentRecords: 'Recent records',
  refresh: 'Refresh',
  remoteAccess: 'Remote access',
  request: 'Request',
  requestErrorLogs: 'Request Error Logs',
  requestLog: 'Request log',
  requestRetry: 'Request retry',
  response: 'Response',
  retry: 'Retry',
  routing: 'Routing',
  routingStrategy: 'Routing strategy',
  save: 'Save',
  searchAccounts: 'Search accounts, providers, auth index',
  sendRequest: 'Send request',
  service: 'Service',
  serviceOnline: 'Service online',
  source: 'Source',
  status: 'Status',
  statusAvailable: 'available',
  statusDisabled: 'disabled',
  statusFailed: 'failed',
  statusOk: 'ok',
  statusUnavailable: 'unavailable',
  success: 'Success',
  themeToggle: 'Toggle theme',
  total: 'Total',
  unableToUnlock: 'Unable to unlock management API',
  unavailable: 'Unavailable',
  unlock: 'Unlock',
  updated: 'Updated',
  url: 'URL',
  yes: 'Yes',
  no: 'No',
} as const;

export type TranslationKey = keyof typeof en;

type TranslationCatalog = Record<TranslationKey, string>;

const zhCN: TranslationCatalog = {
  account: '账号',
  accounts: '账号',
  advancedYaml: '高级 YAML',
  advancedYamlHelp: '编辑原始配置文件。保存前会先由服务器校验。',
  all: '全部',
  apiRequestFailed: '请求失败',
  appTitle: 'CLIProxyAPI 管理',
  auth: '认证',
  authIndex: '认证索引',
  body: '请求体',
  clear: '清空',
  clearAllLogFiles: '确定要清空所有日志文件吗？',
  commonSettings: '常用设置',
  config: '配置',
  configuration: '配置',
  configured: '已配置',
  controlPanel: '控制面板',
  debug: '调试',
  delete: '删除',
  deleteConfirm: '确定要删除 {name} 吗？',
  diff: '差异',
  direct: '直连',
  disable: '禁用',
  disabled: '已禁用',
  download: '下载',
  email: '邮箱',
  enable: '启用',
  enabled: '启用',
  enabledTotal: '已启用 / 总数',
  failed: '失败',
  fileLoggingDisabled: '文件日志未启用',
  filterLogs: '筛选日志',
  healthPending: '健康检查中',
  headersJson: '请求头 JSON',
  language: '语言',
  languageSelect: '选择语言',
  lastRefresh: '上次刷新',
  loading: '加载中',
  loadingAccounts: '正在加载账号',
  lockSession: '锁定会话',
  loggingToFile: '写入日志文件',
  logs: '日志',
  management: '管理',
  managementApi: '管理 API',
  managementKey: '管理密钥',
  managementKeyHelp: '输入本次浏览器会话使用的管理密钥。',
  managementKeyRequired: '请输入管理密钥',
  method: '方法',
  navApiTest: 'API 测试',
  navOverview: '概览',
  noAccountsFilter: '没有账号匹配当前筛选条件',
  noAccountsFound: '未找到账号',
  noCredentialSubstitution: '不替换凭据',
  noLogLines: '没有加载到日志。',
  noRequestErrorLogs: '没有请求错误日志',
  noRequestSent: '还没有发送请求',
  online: '在线',
  panelMode: '面板模式',
  path: '路径',
  project: '项目',
  provider: '提供方',
  providerHealthMatrix: '提供方健康矩阵',
  providerHealthMatrixHelp: '按提供方查看账号可用性和近期请求成功率。',
  proxyUrl: '代理 URL',
  recent: '近期',
  recentRecords: '近期记录',
  refresh: '刷新',
  remoteAccess: '远程访问',
  request: '请求',
  requestErrorLogs: '请求错误日志',
  requestLog: '请求日志',
  requestRetry: '请求重试',
  response: '响应',
  retry: '重试',
  routing: '路由',
  routingStrategy: '路由策略',
  save: '保存',
  searchAccounts: '搜索账号、提供方、认证索引',
  sendRequest: '发送请求',
  service: '服务',
  serviceOnline: '服务在线',
  source: '来源',
  status: '状态',
  statusAvailable: '可用',
  statusDisabled: '已禁用',
  statusFailed: '失败',
  statusOk: '正常',
  statusUnavailable: '不可用',
  success: '成功',
  themeToggle: '切换主题',
  total: '总数',
  unableToUnlock: '无法解锁管理 API',
  unavailable: '不可用',
  unlock: '解锁',
  updated: '更新时间',
  url: 'URL',
  yes: '是',
  no: '否',
};

const translations: Record<Language, TranslationCatalog> = {
  en,
  'zh-CN': zhCN,
};

export function isLanguage(value: string | null | undefined): value is Language {
  return value === 'en' || value === 'zh-CN';
}

export function getInitialLanguage(): Language {
  if (typeof localStorage === 'undefined') {
    return 'en';
  }
  const stored = localStorage.getItem(LANGUAGE_STORAGE);
  return isLanguage(stored) ? stored : 'en';
}

export function persistLanguage(language: Language): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LANGUAGE_STORAGE, language);
  }
}

export function translate(language: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  let text = translations[language][key] || translations.en[key];
  if (!params) return text;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export function statusTranslationKey(status: string): TranslationKey {
  switch (status) {
    case 'available':
      return 'statusAvailable';
    case 'disabled':
      return 'statusDisabled';
    case 'failed':
      return 'statusFailed';
    case 'ok':
      return 'statusOk';
    case 'unavailable':
      return 'statusUnavailable';
    default:
      return 'statusAvailable';
  }
}
