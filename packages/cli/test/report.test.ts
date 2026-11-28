import type { Report } from '@tapebox/shared';
import { validateReport } from '@tapebox/shared';
import { describe, expect, it } from 'vitest';
import { toJUnit, toJson, toMarkdown, toTerminal } from '../src/test/report.js';

const report: Report = {
  tool: 'tapebox',
  schemaVersion: 1,
  version: '0.1.0',
  startedAt: '2026-01-01T00:00:00Z',
  durationMs: 5,
  chain: { mode: 'mock', chainId: 196 },
  summary: { passed: 1, failed: 1, skipped: 0 },
  suites: [
    {
      name: 'NAND',
      circuit: '0x00000002000003',
      circuitId: '1',
      gates: { nand: 1, latch: 0 },
      cases: [
        {
          name: 'in 11',
          kind: 'truthTable',
          status: 'passed',
          durationMs: 2,
          inputs: { in0: true, in1: true },
          expected: { out0: false },
          actual: { out0: false },
        },
      ],
    },
    {
      name: 'BROKEN',
      circuit: '0x00000002000003',
      gates: { nand: 1, latch: 0 },
      cases: [
        {
          name: 'in 00',
          kind: 'truthTable',
          status: 'failed',
          durationMs: 3,
          inputs: { in0: false, in1: false },
          expected: { out0: true },
          actual: { out0: false },
        },
      ],
    },
  ],
};

describe('report formatters', () => {
  it('emits a report that passes the shared validator', () => {
    const parsed = JSON.parse(toJson(report));
    expect(validateReport(parsed).ok).toBe(true);
  });

  it('markdown shows both pass and fail rows', () => {
    const md = toMarkdown(report);
    expect(md).toContain('✅ passed');
    expect(md).toContain('❌ failed');
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
