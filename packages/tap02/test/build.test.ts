import { describe, expect, it } from 'vitest';
import { type CircuitBuilder, circuit } from '../src/build.js';
import { encodeNetlist } from '../src/netlist.js';
import { evalBeat } from '../src/simulate.js';

/** Evaluate a built circuit over every input combination and compare to a reference function. */
function checkTruthTable(
  nIn: number,
  build: (b: CircuitBuilder) => number[],
  ref: (ins: boolean[]) => boolean[],
) {
  const b = circuit(nIn);
  const c = b.build(build(b));
  for (let row = 0; row < 1 << nIn; row++) {
    const ins = Array.from({ length: nIn }, (_, i) => ((row >> i) & 1) === 1);
    expect(evalBeat(c, ins), `inputs ${ins.map(Number).join('')}`).toEqual(ref(ins));
  }
}

describe('CircuitBuilder gates (verified against the simulator)', () => {
  it('not', () =>
    checkTruthTable(
      1,
      (b) => [b.not(b.input(0))],
      ([a]) => [!a],
    ));

  it('and', () =>
    checkTruthTable(
      2,
      (b) => [b.and(b.input(0), b.input(1))],
      ([a, c]) => [a && c],
    ));

  it('or', () =>
    checkTruthTable(
      2,
      (b) => [b.or(b.input(0), b.input(1))],
      ([a, c]) => [a || c],
    ));

  it('xor', () =>
    checkTruthTable(
      2,
      (b) => [b.xor(b.input(0), b.input(1))],
      ([a, c]) => [a !== c],
    ));

  it('mux (sel ? b : a)', () =>
    checkTruthTable(
      3,
      (b) => [b.mux(b.input(0), b.input(1), b.input(2))],
      ([sel, a, c]) => [sel ? c : a],
    ));

  it('half adder (sum, carry)', () =>
    checkTruthTable(
      2,
      (b) => {
        const { sum, carry } = b.halfAdder(b.input(0), b.input(1));
        return [sum, carry];
      },
      ([a, c]) => [a !== c, a && c],
    ));

  it('full adder (sum, carry)', () =>
    checkTruthTable(
      3,
      (b) => {
        const { sum, carry } = b.fullAdder(b.input(0), b.input(1), b.input(2));
        return [sum, carry];
      },
      ([a, c, cin]) => {
        const n = Number(a) + Number(c) + Number(cin);
        return [(n & 1) === 1, n >= 2];
      },
    ));
});

describe('build()', () => {
  it('produces a tapeable circuit (outputs are the last wires)', () => {
    const b = circuit(2);
    const c = b.build([b.xor(b.input(0), b.input(1))]);
    expect(c.inputs).toBe(2);
    expect(c.outputs).toBe(1);
    // Encodable and non-empty — ready for sdk.tapeOut / encodeNetlist.
    expect(encodeNetlist(c.gates)).toMatch(/^0x[0-9a-f]+$/);
  });

  it('keeps multiple outputs in order', () => {
    const b = circuit(2);
    const { sum, carry } = b.halfAdder(b.input(0), b.input(1));
    const c = b.build([sum, carry]);
    // 1 + 1 = (sum 0, carry 1)
    expect(evalBeat(c, [true, true])).toEqual([false, true]);
  });

  it('rejects an empty output list', () => {
    expect(() => circuit(1).build([])).toThrow(/at least one output/);
  });
});

describe('rippleAdder (N-bit)', () => {
  const widths = [1, 4, 8];
  for (const n of widths) {
    it(`${n}-bit adder computes a + b for all/sampled inputs`, () => {
      const b = circuit(2 * n);
      const aw = Array.from({ length: n }, (_, i) => b.input(i));
      const bw = Array.from({ length: n }, (_, i) => b.input(n + i));
      const { sum, carry } = b.rippleAdder(aw, bw);
      const c = b.build([...sum, carry]); // n+1 output bits, lsb first

      const bitsOf = (x: number, w: number) =>
        Array.from({ length: w }, (_, i) => ((x >> i) & 1) === 1);
      const max = 1 << n;
      // Full sweep for small n, a sample for n=8 to keep it quick.
      const pairs: [number, number][] =
        n <= 4
          ? Array.from({ length: max * max }, (_, k) => [k % max, Math.floor(k / max)])
          : [
              [0, 0],
              [1, 1],
              [255, 1],
              [170, 85],
              [255, 255],
              [128, 128],
              [13, 240],
            ];
      for (const [x, y] of pairs) {
        const out = evalBeat(c, [...bitsOf(x, n), ...bitsOf(y, n)]);
        const got = out.reduce((acc, bit, i) => acc + (bit ? 1 << i : 0), 0);
        expect(got, `${x} + ${y}`).toBe(x + y);
      }
    });
  }
});
