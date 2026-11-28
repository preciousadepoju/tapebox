import { type Hex, bytesToHex, hexToBytes } from 'viem';
import {
  type Circuit,
  FIRST_INPUT_WIRE,
  OP,
  assertWellFormed,
  gateOutputWire,
  opName,
  totalWires,
} from './netlist.js';

const nand = (x: boolean, y: boolean): boolean => !(x && y);

/**
 * Evaluate one beat of a purely combinational circuit (NAND gates only).
 *
 * `inputBits[i]` is input i (wire FIRST_INPUT_WIRE + i). Returns the output bits, output j
 * being wire `totalWires - outputs + j` (lowest output wire first).
 *
 * This mirrors the on-chain `eval(id, inputs)`. LATCH gates are stateful and belong to the
 * multi-beat `step()` path, which is not implemented yet (see vectors/README.md); evalBeat
 * throws if it meets one.
 */
export function evalBeat(circuit: Circuit, inputBits: boolean[]): boolean[] {
  assertWellFormed(circuit);
  if (inputBits.length !== circuit.inputs) {
    throw new Error(`expected ${circuit.inputs} input bits, got ${inputBits.length}`);
  }
  const total = totalWires(circuit);
  const wires = new Array<boolean>(total).fill(false);
  wires[0] = false;
  wires[1] = true;
  for (let i = 0; i < circuit.inputs; i++) wires[FIRST_INPUT_WIRE + i] = inputBits[i];

  circuit.gates.forEach((g, k) => {
    const out = gateOutputWire(circuit, k);
    switch (g.op) {
      case OP.NAND:
        wires[out] = nand(wires[g.a], wires[g.b]);
        break;
      case OP.LATCH:
        throw new Error(
          'LATCH is stateful and not supported by evalBeat yet; it belongs to step() (see vectors/README.md)',
        );
      default:
        throw new Error(`unknown op ${opName(g.op)}`);
    }
  });

  return Array.from({ length: circuit.outputs }, (_, j) => wires[total - circuit.outputs + j]);
}

/** Pack bits into bytes the way on-chain eval expects: bit i is in byte i>>3, LSB = bit 0. */
export function packBits(bits: boolean[]): Hex {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => {
    if (bit) bytes[i >> 3] |= 1 << (i & 7);
  });
  return bytesToHex(bytes);
}

/** Inverse of packBits: read `count` bits out of a byte blob (LSB = bit 0). */
export function unpackBits(data: Hex, count: number): boolean[] {
  const bytes = hexToBytes(data);
  return Array.from({ length: count }, (_, i) => (((bytes[i >> 3] ?? 0) >> (i & 7)) & 1) === 1);
}
