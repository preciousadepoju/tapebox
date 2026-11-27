import { describe, expect, it } from 'vitest';
import { packBits, rowBits, unpackBits } from '../lib/bits';
import {
  type Circuit,
  NetlistParseError,
  decodeNetlist,
  encodeNetlist,
  simulate,
  validate,
} from '../lib/netlist';

const n = (a: number, b: number) => ({ op: 'nand' as const, a, b });
const l = (d: number) => ({ op: 'latch' as const, d });

describe('binary netlist encode/decode', () => {
  it('encodes one NAND as the 7-byte record confirmed on mainnet', () => {
    expect(encodeNetlist([n(2, 3)])).toBe('0x00000002000003');
  });

  it('encodes a LATCH as a 4-byte record', () => {
    expect(encodeNetlist([l(4)])).toBe('0x01000004');
  });

  it('round-trips the XOR netlist read from mainnet circuit #1', () => {
    const hex = '0x00000002000003000000020000040000000300000400000005000006';
    const gates = decodeNetlist(hex);
    expect(gates).toEqual([n(2, 3), n(2, 4), n(3, 4), n(5, 6)]);
    expect(encodeNetlist(gates)).toBe(hex);
  });

  it('round-trips the stateful netlist of BEM OTC circuit 0x66 (2 latches, 8 NANDs)', () => {
    const hex =
      '0x0100000701000009000000020000020000000300000300000004000005000000060000060000000200000500000008000008000000070000070000000a00000a';
    const gates = decodeNetlist(hex);
    expect(gates.filter((g) => g.op === 'latch')).toHaveLength(2);
    expect(gates.filter((g) => g.op === 'nand')).toHaveLength(8);
    expect(encodeNetlist(gates)).toBe(hex);
  });

  it('decodes a reuse record (0x02) with its circuits address and id', () => {
    const [g] = decodeNetlist('0x02f044d395c91e77459e6b2155015e14f0dd9b349f00000000000000660001');
    expect(g).toMatchObject({ op: 'ref', id: 0x66n, arg: 1 });
    expect(g && g.op === 'ref' && g.circuits.toLowerCase()).toBe(
      '0xf044d395c91e77459e6b2155015e14f0dd9b349f',
    );
  });

  it('accepts whitespace and a missing 0x', () => {
    expect(decodeNetlist(' 00 000002 000003 ')).toEqual([n(2, 3)]);
  });

  it('rejects bad input', () => {
    expect(() => decodeNetlist('0xzz')).toThrow(NetlistParseError);
    expect(() => decodeNetlist('0x000')).toThrow(/odd/);
    expect(() => decodeNetlist('0x000000020000')).toThrow(/cut short/);
    expect(() => decodeNetlist('0x03000002000003')).toThrow(/opcode/);
    expect(() => encodeNetlist([n(-1, 2)])).toThrow(/range/);
    expect(() => encodeNetlist([n(0x1000000, 2)])).toThrow(/range/);
  });
});

describe('validate mirrors the contract', () => {
  it('flags NANDs that read wires not driven yet ("NAND: future signal")', () => {
    const c: Circuit = { inputs: 2, outputs: 1, gates: [n(2, 4)] };
    expect(
      validate(c)
        .map((i) => i.message)
        .join(),
    ).toMatch(/not driven yet/);
  });
  it('allows latches to read later wires', () => {
    expect(validate({ inputs: 1, outputs: 1, gates: [l(4), n(2, 3)] })).toEqual([]);
  });
  it('needs outputs to fit the gates ("too few signals for outputs")', () => {
    expect(validate({ inputs: 2, outputs: 3, gates: [n(2, 3)] }).length).toBeGreaterThan(0);
    expect(validate({ inputs: 2, outputs: 0, gates: [n(2, 3)] }).length).toBeGreaterThan(0);
  });
});

describe('simulate matches what the fork returned', () => {
  it('NAND truth table', () => {
    const c: Circuit = { inputs: 2, outputs: 1, gates: [n(2, 3)] };
    expect([0, 1, 2, 3].map((r) => simulate(c, rowBits(r, 2)).outputs[0])).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
  it('wire 0 is 0 and wire 1 is 1', () => {
    expect(simulate({ inputs: 0, outputs: 1, gates: [n(1, 1)] }, []).outputs).toEqual([false]);
    expect(simulate({ inputs: 0, outputs: 1, gates: [n(0, 1)] }, []).outputs).toEqual([true]);
  });
  it('outputs are the last wires, lowest first (eval returned 0x01 for in=0 on [NAND, AND])', () => {
    const c: Circuit = { inputs: 2, outputs: 2, gates: [n(2, 3), n(4, 4)] };
    expect(packBits(simulate(c, rowBits(0, 2)).outputs)).toBe('0x01');
    expect(packBits(simulate(c, rowBits(3, 2)).outputs)).toBe('0x02');
  });
  it('BEM OTC counter steps 0 -> 1 -> 2 -> 0 like step() on the fork', () => {
    const c: Circuit = {
      inputs: 0,
      outputs: 1,
      gates: decodeNetlist(
        '0x0100000701000009000000020000020000000300000300000004000005000000060000060000000200000500000008000008000000070000070000000a00000a',
      ),
    };
    let state = [false, false];
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = simulate(c, [], state);
      seen.push(`${packBits(state)}->${packBits(r.nextState)}:${Number(r.outputs[0])}`);
      state = r.nextState;
    }
    expect(seen).toEqual(['0x00->0x01:1', '0x01->0x02:0', '0x02->0x00:0']);
  });
});

describe('bit packing', () => {
  it('is little-endian per byte, LSB = bit 0', () => {
    expect(packBits([])).toBe('0x');
    expect(packBits([true])).toBe('0x01');
    expect(packBits([false, true])).toBe('0x02');
    const nine = Array(9).fill(false);
    nine[8] = true;
    expect(packBits(nine)).toBe('0x0001');
  });
  it('round-trips and treats missing bytes as zero', () => {
    const bits = [true, false, true, true, false, false, true, false, true, true];
    expect(unpackBits(packBits(bits), bits.length)).toEqual(bits);
    expect(unpackBits('0x', 3)).toEqual([false, false, false]);
  });
});
