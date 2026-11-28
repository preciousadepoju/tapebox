/**
 * The canonical Tapebox test-report schema (schema version 1), shared by the CLI test runner
 * (which emits it as `tapebox test --json`) and the website's Reports page (which reads and
 * validates it). One contract, so CLI output loads straight into the UI. Changing this shape is a
 * `shared/` change and needs review.
 */

export const REPORT_SCHEMA_VERSION = 1 as const;

/** Named signal values, e.g. { in0: true, in1: false } or { out0: true }. */
export type Bits = Record<string, boolean>;

export type CaseStatus = 'passed' | 'failed' | 'skipped';
export type CaseKind = 'truthTable' | 'beats';

export interface ReportCase {
  name: string;
  kind: CaseKind;
  status: CaseStatus;
  durationMs: number;
  inputs: Bits;
  expected: Bits;
  actual?: Bits;
  /** Beat index, for `beats` cases. */
  beat?: number;
  txHash?: string;
  message?: string;
}

export interface ReportSuite {
  name: string;
  /** The netlist that was taped out. */
  circuit: string;
  circuitId?: string;
  gates: { nand: number; latch: number };
  cases: ReportCase[];
}

export interface Report {
  tool: 'tapebox';
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  version: string;
  startedAt: string;
  durationMs: number;
  chain: { mode: 'mock' | 'fork' | 'mainnet'; chainId: number; forkBlock?: number };
  summary: { passed: number; failed: number; skipped: number };
  suites: ReportSuite[];
}

export type ValidateResult = { ok: true; report: Report } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isInt = (v: unknown) => isNum(v) && Number.isInteger(v);
const isBits = (v: unknown) => isObj(v) && Object.values(v).every((b) => typeof b === 'boolean');

/** Validate that an unknown value is a well-formed Report (used by the website to vet uploads). */
export function validateReport(input: unknown): ValidateResult {
  const fail = (path: string, message: string): ValidateResult => ({
    ok: false,
    error: `${path}: ${message}`,
  });
  if (!isObj(input)) return fail('(root)', 'expected an object');
  if (input.tool !== 'tapebox') return fail('tool', 'expected "tapebox"');
  if (input.schemaVersion !== REPORT_SCHEMA_VERSION) return fail('schemaVersion', 'expected 1');
  if (typeof input.version !== 'string') return fail('version', 'expected a string');
  if (typeof input.startedAt !== 'string' || Number.isNaN(Date.parse(input.startedAt))) {
    return fail('startedAt', 'expected an ISO date');
  }
  if (!isNum(input.durationMs)) return fail('durationMs', 'expected a number');
  const chain = input.chain;
  if (
    !isObj(chain) ||
    !['mock', 'fork', 'mainnet'].includes(chain.mode as string) ||
    !isInt(chain.chainId)
  ) {
    return fail('chain', 'expected { mode, chainId }');
  }
  const sum = input.summary;
  if (!isObj(sum) || !isInt(sum.passed) || !isInt(sum.failed) || !isInt(sum.skipped)) {
    return fail('summary', 'expected { passed, failed, skipped }');
  }
  if (!Array.isArray(input.suites)) return fail('suites', 'expected an array');
  let cases = 0;
  for (const [i, s] of input.suites.entries()) {
    const p = `suites.${i}`;
    if (!isObj(s) || typeof s.name !== 'string' || typeof s.circuit !== 'string') {
      return fail(p, 'expected { name, circuit }');
    }
    if (!isObj(s.gates) || !isInt(s.gates.nand) || !isInt(s.gates.latch)) {
      return fail(`${p}.gates`, 'expected { nand, latch }');
    }
    if (!Array.isArray(s.cases)) return fail(`${p}.cases`, 'expected an array');
    for (const [j, c] of s.cases.entries()) {
      const q = `${p}.cases.${j}`;
      if (!isObj(c) || typeof c.name !== 'string') return fail(q, 'expected a case');
      if (!['truthTable', 'beats'].includes(c.kind as string)) {
        return fail(`${q}.kind`, 'expected truthTable or beats');
      }
      if (!['passed', 'failed', 'skipped'].includes(c.status as string)) {
        return fail(`${q}.status`, 'bad status');
      }
      if (!isNum(c.durationMs)) return fail(`${q}.durationMs`, 'expected a number');
      if (!isBits(c.inputs) || !isBits(c.expected)) {
        return fail(q, 'inputs and expected must map names to booleans');
      }
      if (c.actual !== undefined && !isBits(c.actual)) {
        return fail(`${q}.actual`, 'expected booleans');
      }
      if (c.txHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(String(c.txHash))) {
        return fail(`${q}.txHash`, 'bad hash');
      }
      cases++;
    }
  }
  const total = (sum.passed as number) + (sum.failed as number) + (sum.skipped as number);
  if (total !== cases) {
    return { ok: false, error: `summary counts ${total} cases but suites contain ${cases}` };
  }
  return { ok: true, report: input as unknown as Report };
}
