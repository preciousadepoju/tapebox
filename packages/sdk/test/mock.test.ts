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

  it('steps a stateful (LATCH) circuit beat by beat', async () => {
    // The official `toggle` circuit: q' = q XOR en, output q XOR en. nState = 1.
    const toggle = '0x0100000700000003000002000000030000040000000200000400000005000006';
    const sdk = createMockSdk();
    const { id } = await sdk.tapeOut({ netlist: toggle, inputs: 1, outputs: 1 });
    expect(await sdk.circuitInfo(id)).toMatchObject({ inputs: 1, outputs: 1, latches: 1 });

    // From state 00 with en=1: output 01, next state 01. Then en=1 again: output 00, next state 00.
    const b1 = await sdk.step(id, '0x00', '0x01');
    expect(b1).toEqual({ newState: '0x01', outputs: '0x01' });
    const b2 = await sdk.step(id, '0x01', '0x01');
    expect(b2).toEqual({ newState: '0x00', outputs: '0x00' });
  });

  it('refuses a REF circuit (single-CPU mock cannot resolve other circuits)', async () => {
    // The official `ref_with_state` circuit (LATCH + REF to toggle + NAND).
    const refCircuit =
      '0x010000040200000000000000000000000000000000000000aa0000000000000001010100000200000003000004';
    await expect(
      createMockSdk().tapeOut({ netlist: refCircuit, inputs: 1, outputs: 1 }),
    ).rejects.toThrow(/REF/);
  });
});
