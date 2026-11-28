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

  it('runs stateful beat sequences via step()', async () => {
    const toggle = '0x0100000700000003000002000000030000040000000200000400000005000006';
    const config: TapeboxConfig = {
      tests: [
        {
          name: 'toggle',
          circuit: { netlist: toggle, inputs: 1, outputs: 1 },
          beats: [
            { state: [0], in: [1], out: [1], newState: [1] },
            { state: [1], in: [1], out: [0], newState: [0] },
            { state: [0], in: [0], out: [0], newState: [0] },
          ],
        },
      ],
    };
    const r = await runSuite(createMockSdk(), config, OPTS);
    expect(r.summary).toMatchObject({ passed: 3, failed: 0 });
    expect(r.suites[0].cases.every((c) => c.kind === 'beats')).toBe(true);
    expect(validateReport(r).ok).toBe(true);
  });

  it('fails a beat whose expected next state is wrong', async () => {
    const toggle = '0x0100000700000003000002000000030000040000000200000400000005000006';
    const config: TapeboxConfig = {
      tests: [
        {
          name: 'toggle',
          circuit: { netlist: toggle, inputs: 1, outputs: 1 },
          beats: [{ state: [0], in: [1], out: [1], newState: [0] }], // wrong: should flip to 1
        },
      ],
    };
    const r = await runSuite(createMockSdk(), config, OPTS);
    expect(r.summary.failed).toBe(1);
    expect(r.suites[0].cases[0].message).toMatch(/next state/);
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
