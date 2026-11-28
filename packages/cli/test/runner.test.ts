import { createMockSdk } from '@tapebox/sdk';
import { describe, expect, it } from 'vitest';
import type { TapeboxConfig } from '../src/test/config.js';
import { runSuite } from '../src/test/runner.js';

const nand = { inputs: 2, outputs: 1, gates: [{ op: 0, a: 2, b: 3 }] };

describe('runSuite (against the mock SDK, no chain)', () => {
  it('passes a correct truth table', async () => {
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
    const r = await runSuite(createMockSdk(), config, '0.1.0');
    expect(r.passed).toBe(1);
    expect(r.failed).toBe(0);
    expect(r.cases[0].circuitId).toBe('1');
  });

  it('fails a wrong expectation and records the mismatch', async () => {
    const config: TapeboxConfig = {
      tests: [{ name: 'NAND', circuit: nand, truthTable: [{ in: [1, 1], out: [1] }] }],
    };
    const r = await runSuite(createMockSdk(), config, '0.1.0');
    expect(r.failed).toBe(1);
    expect(r.cases[0].checks[0]).toMatchObject({ expected: [true], actual: [false], pass: false });
  });

  it('reports a tape-out error as a failed case', async () => {
    const config: TapeboxConfig = {
      // forward reference (b=4 is the gate's own output wire) -> the well-formedness check rejects it
      tests: [{ name: 'bad', circuit: { inputs: 2, outputs: 1, gates: [{ op: 0, a: 2, b: 4 }] } }],
    };
    const r = await runSuite(createMockSdk(), config, '0.1.0');
    expect(r.failed).toBe(1);
    expect(r.cases[0].error).toMatch(/not available|not well-formed/);
  });
});
