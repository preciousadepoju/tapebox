import { describe, expect, it } from 'vitest';
import {
  type Circuit,
  OP,
  assertWellFormed,
  checkWellFormed,
  decodeNetlist,
  encodeNetlist,
} from '../src/netlist.js';

/** The circuit A confirmed on mainnet: one NAND of inputs on wires 2 and 3. */
const SINGLE_NAND: Circuit = { inputs: 2, outputs: 1, gates: [{ op: OP.NAND, a: 2, b: 3 }] };

describe('encode / decode', () => {
  it('encodes a single NAND to the mainnet-confirmed bytes', () => {
    expect(encodeNetlist(SINGLE_NAND.gates)).toBe('0x00000002000003');
  });

  it('encodes an empty netlist as 0x', () => {
    expect(encodeNetlist([])).toBe('0x');
  });

  it('round-trips through decode', () => {
    const gates = [
      { op: OP.NAND, a: 2, b: 3 },
      { op: OP.NAND, a: 4, b: 2 },
    ];
    expect(decodeNetlist(encodeNetlist(gates))).toEqual(gates);
  });

  it('rejects a netlist whose byte length is not a multiple of 7', () => {
    expect(() => decodeNetlist('0x0000')).toThrow(/multiple of 7/);
  });
});

describe('well-formedness', () => {
  it('accepts the single NAND', () => {
    expect(checkWellFormed(SINGLE_NAND)).toEqual([]);
  });

  it('flags a forward reference (gate reads a wire >= its own output)', () => {
    const errs = checkWellFormed({ inputs: 2, outputs: 1, gates: [{ op: OP.NAND, a: 2, b: 4 }] });
    expect(errs.some((e) => /forward reference/.test(e.message))).toBe(true);
  });

  it('flags an unknown op', () => {
    const errs = checkWellFormed({
      inputs: 2,
      outputs: 1,
      gates: [{ op: 0x7f as unknown as (typeof OP)[keyof typeof OP], a: 2, b: 3 }],
    });
    expect(errs.some((e) => /unknown op/.test(e.message))).toBe(true);
  });

  it('flags more outputs than gates', () => {
    const errs = checkWellFormed({ ...SINGLE_NAND, outputs: 2 });
    expect(errs.some((e) => /exceeds the number of gates/.test(e.message))).toBe(true);
  });

  it('assertWellFormed throws on an out-of-reach wire', () => {
    expect(() =>
      assertWellFormed({ inputs: 2, outputs: 1, gates: [{ op: OP.NAND, a: 2, b: 9 }] }),
    ).toThrow(/not well-formed/);
  });
});
