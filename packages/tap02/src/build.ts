import { type Circuit, FIRST_INPUT_WIRE, type Gate, OP } from './netlist.js';

/**
 * A small builder for composing TAP-02 circuits out of real logic instead of hand-written NAND
 * bytes. Everything reduces to NAND (the one gate TapeOut has), so `not/and/or/xor/mux/adders`
 * are all expressed in terms of `nand`. Each method returns the wire number holding its result;
 * `build(outputs)` finishes with the chosen wires as the circuit's outputs.
 *
 *   const b = new CircuitBuilder(2);
 *   const [a, bIn] = b.inputWires;
 *   const circuit = b.build([b.xor(a, bIn)]);   // a 1-bit XOR, ready for sdk.tapeOut(circuit)
 */
export const ZERO = 0;
export const ONE = 1;

export class CircuitBuilder {
  private readonly gates: Gate[] = [];

  constructor(public readonly inputs: number) {
    if (!Number.isInteger(inputs) || inputs < 0)
      throw new Error('inputs must be a non-negative integer');
  }

  /** Wire carrying input `i` (0-based). */
  input(i: number): number {
    if (i < 0 || i >= this.inputs) throw new Error(`input ${i} out of range 0..${this.inputs - 1}`);
    return FIRST_INPUT_WIRE + i;
  }

  /** All input wires, in order. */
  get inputWires(): number[] {
    return Array.from({ length: this.inputs }, (_, i) => this.input(i));
  }

  /** The one primitive. Appends a NAND(a, b) and returns the wire it drives. */
  nand(a: number, b: number): number {
    this.gates.push({ op: OP.NAND, a, b });
    return FIRST_INPUT_WIRE + this.inputs + this.gates.length - 1;
  }

  not(a: number): number {
    return this.nand(a, a);
  }

  and(a: number, b: number): number {
    return this.not(this.nand(a, b));
  }

  or(a: number, b: number): number {
    return this.nand(this.not(a), this.not(b));
  }

  xor(a: number, b: number): number {
    const n = this.nand(a, b);
    return this.nand(this.nand(a, n), this.nand(b, n));
  }

  nor(a: number, b: number): number {
    return this.not(this.or(a, b));
  }

  xnor(a: number, b: number): number {
    return this.not(this.xor(a, b));
  }

  /** 1 iff every bit of `a` equals the corresponding bit of `b` (equal-width operands). */
  equals(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error('equals needs equal-width operands');
    if (a.length === 0) return ONE;
    let acc = this.xnor(a[0], b[0]);
    for (let i = 1; i < a.length; i++) acc = this.and(acc, this.xnor(a[i], b[i]));
    return acc;
  }

  /** 2:1 multiplexer: returns `b` when `sel` is 1, else `a`. */
  mux(sel: number, a: number, b: number): number {
    return this.or(this.and(a, this.not(sel)), this.and(b, sel));
  }

  /** Half adder: sum = a XOR b, carry = a AND b. */
  halfAdder(a: number, b: number): { sum: number; carry: number } {
    return { sum: this.xor(a, b), carry: this.and(a, b) };
  }

  /** Full adder: sum and carry-out of a + b + carry-in. */
  fullAdder(a: number, b: number, cin: number): { sum: number; carry: number } {
    const s1 = this.xor(a, b);
    return {
      sum: this.xor(s1, cin),
      carry: this.or(this.and(a, b), this.and(s1, cin)),
    };
  }

  /**
   * N-bit ripple-carry adder. `a` and `b` are equal-length wire arrays, least-significant bit
   * first. Returns the N sum wires (lsb first) and the final carry-out.
   */
  rippleAdder(a: number[], b: number[]): { sum: number[]; carry: number } {
    if (a.length !== b.length) throw new Error('rippleAdder needs equal-width operands');
    const sum: number[] = [];
    let carry = ZERO; // wire 0 is constant 0
    for (let i = 0; i < a.length; i++) {
      const r = this.fullAdder(a[i], b[i], carry);
      sum.push(r.sum);
      carry = r.carry;
    }
    return { sum, carry };
  }

  /**
   * Finish the circuit. The given wires become its outputs (lowest output bit first). TAP-02
   * requires the outputs to be the final wires, so each is buffered (double-NAND) to land
   * contiguously at the end regardless of where it was computed.
   */
  build(outputs: number[]): Circuit {
    if (outputs.length === 0) throw new Error('a circuit needs at least one output');
    const inverted = outputs.map((w) => this.not(w));
    for (const n of inverted) this.not(n); // buffers, appended last and in order
    return { inputs: this.inputs, outputs: outputs.length, gates: [...this.gates] };
  }
}

/** Convenience factory: `circuit(2)` === `new CircuitBuilder(2)`. */
export function circuit(inputs: number): CircuitBuilder {
  return new CircuitBuilder(inputs);
}
