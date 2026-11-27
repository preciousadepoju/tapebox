import { OP } from '@tapebox/tap02';
import { describe, expect, it } from 'vitest';
import { createMockSdk } from '../src/mock.js';

describe('mock SDK (what C builds against before the fork lands)', () => {
  it('tapes out a NAND and evals its truth table with no chain', async () => {
    const sdk = createMockSdk();
    const { id, netlist } = await sdk.tapeOut({
      inputs: 2,
      outputs: 1,
      gates: [{ op: OP.NAND, a: 2, b: 3 }],
    });
    expect(netlist).toBe('0x00000002000003');
    expect(id).toBe(1n);

    for (const [a, b] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ] as const) {
      const { outputs } = await sdk.eval(id, [a, b]);
      expect(outputs).toEqual([!(a && b)]);
    }

    expect(await sdk.circuitInfo(id)).toMatchObject({ inputs: 2, outputs: 1, gates: 1 });
    expect(await sdk.getNetlist(id)).toBe('0x00000002000003');
  });

  it('accepts a pre-encoded netlist and packed-byte inputs', async () => {
    const sdk = createMockSdk();
    const { id } = await sdk.tapeOut({ netlist: '0x00000002000003', inputs: 2, outputs: 1 });
    const { raw } = await sdk.eval(id, '0x03'); // a=1, b=1 -> NAND = 0
    expect(raw).toBe('0x00');
  });

  it('throws evaluating an unknown circuit', async () => {
    await expect(createMockSdk().eval(99n, [true, false])).rejects.toThrow(/no circuit/);
  });
});
