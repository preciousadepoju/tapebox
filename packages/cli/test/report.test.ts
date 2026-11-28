import { describe, expect, it } from 'vitest';
import { type RunReport, toJUnit, toJson, toMarkdown, toTerminal } from '../src/test/report.js';

const report: RunReport = {
  tool: 'tapebox',
  version: '0.1.0',
  startedAt: '2026-01-01T00:00:00Z',
  durationMs: 5,
  total: 2,
  passed: 1,
  failed: 1,
  cases: [
    {
      name: 'NAND',
      circuitId: '1',
      checks: [{ name: 'in 11', expected: [false], actual: [false], pass: true }],
      pass: true,
      durationMs: 2,
    },
    {
      name: 'BROKEN',
      checks: [{ name: 'in 00', expected: [true], actual: [false], pass: false }],
      pass: false,
      durationMs: 3,
    },
  ],
};

describe('report formatters', () => {
  it('json is valid and preserves the counts', () => {
    expect(JSON.parse(toJson(report)).failed).toBe(1);
  });

  it('markdown shows both pass and fail rows', () => {
    const md = toMarkdown(report);
    expect(md).toContain('✅ pass');
    expect(md).toContain('❌ fail');
    expect(md).toContain('expected 1, got 0');
  });

  it('junit is well-formed and marks the failure', () => {
    const x = toJUnit(report);
    expect(x).toContain('<testsuites');
    expect(x).toContain('failures="1"');
    expect(x).toContain('<failure');
  });

  it('terminal prints a FAIL summary', () => {
    expect(toTerminal(report)).toMatch(/FAIL/);
  });
});
