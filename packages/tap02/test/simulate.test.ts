import { describe, expect, it } from 'vitest';
import { type Circuit, OP } from '../src/netlist.js';
import { evalBeat, packBits, unpackBits } from '../src/simulate.js';

const SINGLE_NAND: Circuit = { inputs: 2, outputs: 1, gates: [{ op: OP.NAND, a: 2, b: 3 }] };

describe('evalBeat', () => {
  it("matches the NAND truth table (the same oracle as A's spike)", () => {
    for (const [a, b] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ] as const) {
      expect(evalBeat(SINGLE_NAND, [a, b])).toEqual([!(a && b)]);
    }
  });

  it('throws on the wrong number of input bits', () => {
    expect(() => evalBeat(SINGLE_NAND, [true])).toThrow(/input bits/);
  });

  it('throws if asked to evaluate a stateful LATCH', () => {
    expect(() =>
      evalBeat({ inputs: 1, outputs: 1, gates: [{ op: OP.LATCH, a: 2, b: 0 }] }, [true]),
    ).toThrow(/LATCH/);
  });
});

describe('bit packing (LSB = bit 0, matches on-chain eval)', () => {
  it('packs bits into bytes', () => {
    expect(packBits([false, true])).toBe('0x02');
    expect(packBits([true, false, true])).toBe('0x05');
  });

  it('round-trips through unpack', () => {
    expect(unpackBits('0x02', 2)).toEqual([false, true]);
    expect(unpackBits(packBits([true, false, true]), 3)).toEqual([true, false, true]);
  });
});
