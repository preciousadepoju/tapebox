import { describe, expect, it } from 'vitest';
import { summarize } from '../src/stateful.js';

describe('summarize', () => {
  it('describes a single NAND (combinational)', () => {
    const s = summarize('0x00000002000003', 2);
    expect(s).toEqual({ records: 1, nand: 1, latch: 0, ref: 0, signals: 5, stateful: false });
  });

  it('describes the toggle circuit (stateful: LATCH + NAND)', () => {
    const s = summarize('0x0100000700000003000002000000030000040000000200000400000005000006', 1);
    expect(s.nand).toBe(4);
    expect(s.latch).toBe(1);
    expect(s.ref).toBe(0);
    expect(s.stateful).toBe(true);
    expect(s.signals).toBe(2 + 1 + 5); // constants + inputs + produced wires
  });
});
