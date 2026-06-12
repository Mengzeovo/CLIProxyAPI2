import type { AuthFile, RecentRequestBucket } from './types';

export function providerOf(auth: AuthFile): string {
  return (auth.provider || auth.type || 'unknown').trim() || 'unknown';
}

export function statusOf(auth: AuthFile): string {
  if (auth.disabled) return 'disabled';
  if (auth.unavailable) return 'unavailable';
  return (auth.status || 'available').toLowerCase();
}

export function recentTotals(buckets?: RecentRequestBucket[]): { success: number; failed: number } {
  return (buckets || []).reduce<{ success: number; failed: number }>(
    (acc, bucket) => {
      acc.success += Number(bucket.success ?? bucket.Success ?? 0);
      acc.failed += Number(bucket.failed ?? bucket.Failed ?? 0);
      return acc;
    },
    { success: 0, failed: 0 },
  );
}

export function successRate(auths: AuthFile[]): number {
  const totals = auths.reduce<{ success: number; failed: number }>(
    (acc, auth) => {
      const recent = recentTotals(auth.recent_requests);
      acc.success += Number(auth.success ?? 0) + recent.success;
      acc.failed += Number(auth.failed ?? 0) + recent.failed;
      return acc;
    },
    { success: 0, failed: 0 },
  );
  const total = totals.success + totals.failed;
  return total === 0 ? 100 : Math.round((totals.success / total) * 100);
}

export function maskSecret(value?: string): string {
  const text = (value || '').trim();
  if (!text) return '-';
  if (text.length <= 10) return `${text.slice(0, 2)}••••`;
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

export function formatDate(value?: string | number): string {
  if (!value) return '-';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function bytes(value?: number): string {
  const size = Number(value || 0);
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let current = size;
  let unit = 0;
  while (current >= 1024 && unit < units.length - 1) {
    current /= 1024;
    unit += 1;
  }
  return `${current.toFixed(current >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function buildLineDiff(before: string, after: string): Array<{ type: 'same' | 'add' | 'remove'; text: string }> {
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const rows: Array<{ type: 'same' | 'add' | 'remove'; text: string }> = [];
  for (let i = 0; i < max; i += 1) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      if (oldLine !== undefined) rows.push({ type: 'same', text: ` ${oldLine}` });
      continue;
    }
    if (oldLine !== undefined) rows.push({ type: 'remove', text: `-${oldLine}` });
    if (newLine !== undefined) rows.push({ type: 'add', text: `+${newLine}` });
  }
  return rows;
}
