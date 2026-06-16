import { describe, expect, it } from 'vitest';
import { generateApiKey, mergeBuckets, recentTotals } from './utils';

describe('generateApiKey', () => {
  it('prefixes keys with sk- and uses the requested length', () => {
    const key = generateApiKey(48);
    expect(key.startsWith('sk-')).toBe(true);
    expect(key.length).toBe(3 + 48);
  });

  it('only emits base62 characters after the prefix', () => {
    expect(generateApiKey().slice(3)).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('produces distinct keys across calls', () => {
    expect(generateApiKey()).not.toBe(generateApiKey());
  });
});

describe('mergeBuckets', () => {
  it('returns an empty array when no sources have buckets', () => {
    expect(mergeBuckets([undefined, []])).toEqual([]);
  });

  it('sums success/failed across sources aligned by index', () => {
    const merged = mergeBuckets([
      [
        { time: '14:00-14:10', success: 2, failed: 1 },
        { time: '14:10-14:20', success: 0, failed: 0 },
      ],
      [
        { time: '14:00-14:10', success: 3, failed: 0 },
        { time: '14:10-14:20', success: 1, failed: 4 },
      ],
    ]);

    expect(merged).toEqual([
      { label: '14:00-14:10', success: 5, failed: 1 },
      { label: '14:10-14:20', success: 1, failed: 4 },
    ]);
  });

  it('handles sources of differing lengths and capitalized keys', () => {
    const merged = mergeBuckets([
      [{ time: 'a', Success: 1, Failed: 2 }],
      [
        { time: 'a', success: 1 },
        { time: 'b', success: 5, failed: 5 },
      ],
    ]);

    expect(merged).toEqual([
      { label: 'a', success: 2, failed: 2 },
      { label: 'b', success: 5, failed: 5 },
    ]);
  });
});

describe('recentTotals', () => {
  it('totals success and failed counts', () => {
    expect(recentTotals([{ success: 1, failed: 2 }, { Success: 3, Failed: 4 }])).toEqual({ success: 4, failed: 6 });
  });

  it('returns zeros for undefined input', () => {
    expect(recentTotals(undefined)).toEqual({ success: 0, failed: 0 });
  });
});
