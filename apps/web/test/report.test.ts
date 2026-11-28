import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateReport } from '../lib/report';

const sample = JSON.parse(
  readFileSync(new URL('../public/sample-report.json', import.meta.url), 'utf8'),
);

describe('validateReport', () => {
  it('accepts the sample report', () => {
    expect(validateReport(sample).ok).toBe(true);
  });
  it('rejects wrong tools and mismatched counts', () => {
    expect(validateReport({ ...sample, tool: 'other' })).toMatchObject({ ok: false });
    const r = validateReport({ ...sample, summary: { passed: 1, failed: 0, skipped: 0 } });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/summary counts/);
  });
});
