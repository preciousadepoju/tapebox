import { type Hex, concatHex, hexToBytes, numberToHex } from 'viem';

/**
 * TAP-02 netlist format.
 *
 * A netlist is a sequence of fixed 7-byte records: a 1-byte op code, then two 3-byte
 * (uint24, big-endian) wire numbers. This is confirmed against TapeOut on X Layer mainnet
 * by Person A's spike: a single NAND of wires 2 and 3 encodes to 0x00000002000003 and
 * tapes out + evals correctly.
 *
 * Wire numbering (confirmed with A):
 *   wire 0, 1                     constants 0 and 1
 *   wires 2 .. 2 + inputs - 1     the circuit inputs
 *   gate k (0-indexed)            drives wire 2 + inputs + k, and may reference only
 *                                 earlier wires (no forward references)
 *   the last `outputs` wires      the circuit outputs, lowest output wire first
 */

/** One record is 7 bytes: op (1) + wire a (3) + wire b (3). */
export const RECORD_BYTES = 7;

/** Wire numbers are uint24. */
export const MAX_WIRE = 0xff_ff_ff;

/** Inputs begin at this wire; wires 0 and 1 are the constants 0 and 1. */
export const FIRST_INPUT_WIRE = 2;

/**
 * Gate op codes. NAND (0x00) is confirmed against mainnet. LATCH's op byte and record
 * shape are NOT yet confirmed — treat as a placeholder until checked against the official
 * vectors (see vectors/README.md).
 */
export const OP = { NAND: 0x00, LATCH: 0x01 } as const;
export type Op = (typeof OP)[keyof typeof OP];

const OP_NAMES = new Map<number, string>([
  [OP.NAND, 'NAND'],
  [OP.LATCH, 'LATCH'],
]);

export function opName(op: number): string {
  return OP_NAMES.get(op) ?? `0x${op.toString(16).padStart(2, '0')}`;
}

export interface Gate {
  op: Op;
  a: number;
  b: number;
}

export interface Circuit {
  inputs: number;
  outputs: number;
  gates: Gate[];
}

/** Total number of wires a circuit uses: 2 constants + inputs + one per gate. */
export function totalWires(c: Pick<Circuit, 'inputs'> & { gates: { length: number } }): number {
  return FIRST_INPUT_WIRE + c.inputs + c.gates.length;
}

/** The wire that gate `gateIndex` drives. */
export function gateOutputWire(c: Pick<Circuit, 'inputs'>, gateIndex: number): number {
  return FIRST_INPUT_WIRE + c.inputs + gateIndex;
}

function assertWire(name: string, w: number): void {
  if (!Number.isInteger(w) || w < 0 || w > MAX_WIRE) {
    throw new Error(`wire ${name}=${w} out of range 0..${MAX_WIRE}`);
  }
}

/** Encode a single gate to its 7-byte record. */
export function encodeGate(g: Gate): Hex {
  if (!OP_NAMES.has(g.op)) throw new Error(`unknown op ${opName(g.op)}`);
  assertWire('a', g.a);
  assertWire('b', g.b);
  return concatHex([
    numberToHex(g.op, { size: 1 }),
    numberToHex(g.a, { size: 3 }),
    numberToHex(g.b, { size: 3 }),
  ]);
}

/** Encode a list of gates to a netlist blob ready for `tapeout(netlist, inputs, outputs)`. */
export function encodeNetlist(gates: Gate[]): Hex {
  return gates.length === 0 ? '0x' : concatHex(gates.map(encodeGate));
}

/** Decode a netlist blob back into gates. Throws if the byte length is not a multiple of 7. */
export function decodeNetlist(netlist: Hex): Gate[] {
  const bytes = hexToBytes(netlist);
  if (bytes.length % RECORD_BYTES !== 0) {
    throw new Error(`netlist length ${bytes.length} is not a multiple of ${RECORD_BYTES}`);
  }
  const gates: Gate[] = [];
  for (let i = 0; i < bytes.length; i += RECORD_BYTES) {
    const op = bytes[i] as Op;
    const a = (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
    const b = (bytes[i + 4] << 16) | (bytes[i + 5] << 8) | bytes[i + 6];
    gates.push({ op, a, b });
  }
  return gates;
}

export interface WellFormedError {
  /** Gate index the problem is on, or -1 for a circuit-level problem. */
  gate: number;
  message: string;
}

/**
 * Structural checks that do not need a chain: known ops, in-range wires, no forward
 * references, and consistent input/output counts. Returns every problem found (empty = OK).
 */
export function checkWellFormed(c: Circuit): WellFormedError[] {
  const errs: WellFormedError[] = [];
  if (!Number.isInteger(c.inputs) || c.inputs < 0) {
    errs.push({ gate: -1, message: `inputs must be a non-negative integer (got ${c.inputs})` });
  }
  if (!Number.isInteger(c.outputs) || c.outputs < 0) {
    errs.push({ gate: -1, message: `outputs must be a non-negative integer (got ${c.outputs})` });
  }
  // Outputs are the last `outputs` wires, which are exactly the gate-driven wires, so there
  // must be at least that many gates.
  if (c.outputs > c.gates.length) {
    errs.push({
      gate: -1,
      message: `outputs (${c.outputs}) exceeds the number of gates (${c.gates.length})`,
    });
  }
  c.gates.forEach((g, k) => {
    if (!OP_NAMES.has(g.op)) errs.push({ gate: k, message: `unknown op ${opName(g.op)}` });
    const out = gateOutputWire(c, k);
    for (const [name, w] of [
      ['a', g.a],
      ['b', g.b],
    ] as const) {
      if (!Number.isInteger(w) || w < 0 || w > MAX_WIRE) {
        errs.push({ gate: k, message: `wire ${name}=${w} out of range 0..${MAX_WIRE}` });
      } else if (w >= out) {
        errs.push({
          gate: k,
          message: `references wire ${name}=${w}, which is not defined before this gate's output wire ${out} (no forward references)`,
        });
      }
    }
  });
  return errs;
}

/** Throw a readable error if the circuit is not well-formed. */
export function assertWellFormed(c: Circuit): void {
  const errs = checkWellFormed(c);
  if (errs.length > 0) {
    throw new Error(
      `netlist is not well-formed:\n${errs
        .map((e) => `  ${e.gate < 0 ? 'circuit' : `gate ${e.gate}`}: ${e.message}`)
        .join('\n')}`,
    );
  }
}
