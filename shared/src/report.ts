import type { Hex } from 'viem';

/**
 * The canonical Tapebox test-report schema, shared by the CLI test runner (which produces it),
 * the GitHub Action, and any consumer that reads a report. Changing this shape is a `shared/`
 * change and needs review, because it is a cross-package contract.
 *
 * The JSON form is exactly this shape serialized; `REPORT_FORMAT` tags the version so a reader
 * can tell which layout it is looking at.
 */
export const REPORT_FORMAT = 'tapebox-report/1' as const;

/** One truth-table (or beat) check within a test case. */
export interface CheckResult {
  name: string;
  /** Expected output bits, lowest output wire first. */
  expected: boolean[];
  /** Actual output bits the circuit produced. */
  actual: boolean[];
  pass: boolean;
}

/** The result of taping out and checking one circuit from the config. */
export interface CaseResult {
  name: string;
  /** The minted circuit id, when the tape-out succeeded. */
  circuitId?: string;
  /** The netlist that was taped out. */
  netlist?: Hex;
  checks: CheckResult[];
  pass: boolean;
  durationMs: number;
  /** Present when the case failed to run (e.g. the tape-out reverted). */
  error?: string;
}

/** A full test run: the top-level object written to the JSON report. */
export interface RunReport {
  tool: 'tapebox';
  /** CLI version that produced the report. */
  version: string;
  startedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  cases: CaseResult[];
}
