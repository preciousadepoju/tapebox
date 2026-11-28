import { createMockSdk } from '@tapebox/sdk';
import { validateReport } from '@tapebox/shared';
import { describe, expect, it } from 'vitest';
import type { TapeboxConfig } from '../src/test/config.js';
import { type RunOptions, runSuite } from '../src/test/runner.js';

const nand = { inputs: 2, outputs: 1, gates: [{ op: 0, a: 2, b: 3 }] };
const OPTS: RunOptions = { version: '0.1.0', mode: 'mock', chainId: 196 };

describe('runSuite (against the mock SDK, no chain)', () => {
  it('passes a correct truth table and emits a valid report', async () => {
    const config: TapeboxConfig = {
      tests: [
        {
          name: 'NAND',
          circuit: nand,
          truthTable: [
            { in: [0, 0], out: [1] },
            { in: [1, 1], out: [0] },
          ],
        },
      ],
    };
    const r = await runSuite(createMockSdk(), config, OPTS);
    expect(r.summary).toMatchObject({ passed: 2, failed: 0, skipped: 0 });
    expect(r.suites[0].circuitId).toBe('1');
    expect(r.suites[0].gates).toEqual({ nand: 1, latch: 0 });
    expect(validateReport(r).ok).toBe(true);
  });

  it('fails a wrong expectation and records the mismatch', async () => {
    const config: TapeboxConfig = {
      tests: [{ name: 'NAND', circuit: nand, truthTable: [{ in: [1, 1], out: [1] }] }],
    };
    const r = await runSuite(createMockSdk(), config, OPTS);
    expect(r.summary.failed).toBe(1);
    expect(r.suites[0].cases[0]).toMatchObject({
      status: 'failed',
      expected: { out0: true },
      actual: { out0: false },
    });
  });

  it('reports a tape-out error as a failed case', async () => {
    const config: TapeboxConfig = {
      // forward reference (b=4 is the gate's own output wire) -> the well-formedness check rejects it
      tests: [{ name: 'bad', circuit: { inputs: 2, outputs: 1, gates: [{ op: 0, a: 2, b: 4 }] } }],
    };
    const r = await runSuite(createMockSdk(), config, OPTS);
    expect(r.summary.failed).toBe(1);
    expect(r.suites[0].cases[0].message).toMatch(/not available|not well-formed/);
  });
});
