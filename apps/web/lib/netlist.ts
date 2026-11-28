import { type Address, type Hex, getAddress, isHex } from 'viem';

/**
 * TapeOut netlists, as read from the Circuits contract and checked by tapeout/eval/step on the fork.
 *
 * Wires: 0 is constant 0, 1 is constant 1, inputs are wires 2 .. 2+inputs-1, then every record
 * drives the next wire in order (gates and latches alike). Outputs are the last `outputs` wires,
 * output bit 0 being the lowest of them.
 *
 * Records:
 *   NAND  7 bytes  0x00 | a (3 bytes) | b (3 bytes)    a and b must be earlier wires
 *   LATCH 4 bytes  0x01 | d (3 bytes)                  d may be any wire, read at the end of a step
 *   REF   31 bytes 0x02 | circuits (20) | id (8) | arg (2)   reuse another circuit (decode only)
 *
 * Latch state is bit-packed in record order: the first latch is state bit 0.
 */

export const OP_NAND = 0x00;
export const OP_LATCH = 0x01;
export const OP_REF = 0x02;
export const MAX_WIRE = 0xff_ffff;

export type NandGate = { op: 'nand'; a: number; b: number };
export type LatchGate = { op: 'latch'; d: number };
export type RefGate = { op: 'ref'; circuits: Address; id: bigint; arg: number };
export type Gate = NandGate | LatchGate | RefGate;

export interface Circuit {
  inputs: number;
  outputs: number;
  gates: Gate[];
}

const RECORD_SIZE = { [OP_NAND]: 7, [OP_LATCH]: 4, [OP_REF]: 31 } as const;

function hex(n: number | bigint, bytes: number): string {
  return n.toString(16).padStart(bytes * 2, '0');
}

function wireOk(w: number) {
  return Number.isInteger(w) && w >= 0 && w <= MAX_WIRE;
}

export function encodeGate(g: Gate): string {
  switch (g.op) {
    case 'nand':
      if (!wireOk(g.a) || !wireOk(g.b)) throw new Error('wire out of range');
      return hex(OP_NAND, 1) + hex(g.a, 3) + hex(g.b, 3);
    case 'latch':
      if (!wireOk(g.d)) throw new Error('wire out of range');
      return hex(OP_LATCH, 1) + hex(g.d, 3);
    case 'ref':
      return hex(OP_REF, 1) + g.circuits.slice(2).toLowerCase() + hex(g.id, 8) + hex(g.arg, 2);
  }
}

export function encodeNetlist(gates: readonly Gate[]): Hex {
  return `0x${gates.map(encodeGate).join('')}`;
}

export class NetlistParseError extends Error {}

export function decodeNetlist(input: string): Gate[] {
  const raw = input.trim().replace(/\s+/g, '');
  const h = raw.startsWith('0x') || raw.startsWith('0X') ? `0x${raw.slice(2)}` : `0x${raw}`;
  if (!isHex(h)) throw new NetlistParseError('Netlist must be hex');
  const body = h.slice(2).toLowerCase();
  if (body.length % 2) throw new NetlistParseError('Netlist has an odd number of hex digits');
  const gates: Gate[] = [];
  let i = 0;
  while (i < body.length) {
    const op = Number.parseInt(body.slice(i, i + 2), 16);
    const size = RECORD_SIZE[op as keyof typeof RECORD_SIZE];
    if (size === undefined) {
      throw new NetlistParseError(`Unknown opcode 0x${hex(op, 1)} at byte ${i / 2}`);
    }
    if (i + size * 2 > body.length) {
      throw new NetlistParseError(`Record at byte ${i / 2} is cut short`);
    }
    const rec = body.slice(i + 2, i + size * 2);
    if (op === OP_NAND) {
      gates.push({
        op: 'nand',
        a: Number.parseInt(rec.slice(0, 6), 16),
        b: Number.parseInt(rec.slice(6, 12), 16),
      });
    } else if (op === OP_LATCH) {
      gates.push({ op: 'latch', d: Number.parseInt(rec.slice(0, 6), 16) });
    } else {
      gates.push({
        op: 'ref',
        circuits: getAddress(`0x${rec.slice(0, 40)}`),
        id: BigInt(`0x${rec.slice(40, 56)}`),
        arg: Number.parseInt(rec.slice(56, 60), 16),
      });
    }
    i += size * 2;
  }
  return gates;
}

/** Wire number driven by record `index`. */
export function gateWire(inputs: number, index: number) {
  return 2 + inputs + index;
}

export function totalWires(c: Pick<Circuit, 'inputs' | 'gates'>) {
  return 2 + c.inputs + c.gates.length;
}

/** Human label for a wire: 0, 1, in0.., g0.. / L0.. */
export function wireLabel(c: Pick<Circuit, 'inputs' | 'gates'>, wire: number): string {
  if (wire === 0) return '0';
  if (wire === 1) return '1';
  if (wire < 2 + c.inputs) return `in${wire - 2}`;
  const idx = wire - 2 - c.inputs;
  const g = c.gates[idx];
  if (!g) return `w${wire}`;
  return g.op === 'latch' ? `L${latchIndex(c.gates, idx)}` : `g${idx}`;
}

function latchIndex(gates: readonly Gate[], idx: number) {
  let n = 0;
  for (let i = 0; i < idx; i++) if (gates[i]?.op === 'latch') n++;
  return n;
}

export function countOps(gates: readonly Gate[]) {
  let nand = 0;
  let latch = 0;
  let ref = 0;
  for (const g of gates) {
    if (g.op === 'nand') nand++;
    else if (g.op === 'latch') latch++;
    else ref++;
  }
  return { nand, latch, ref };
}

export interface Issue {
  gate?: number;
  message: string;
}

/** Mirror of the contract's checks, so builders see problems before paying the tapeout fee. */
export function validate(c: Circuit): Issue[] {
  const issues: Issue[] = [];
  if (!Number.isInteger(c.inputs) || c.inputs < 0)
    issues.push({ message: 'Inputs must be 0 or more' });
  if (!Number.isInteger(c.outputs) || c.outputs < 1)
    issues.push({ message: 'Need at least 1 output' });
  if (c.gates.length === 0) issues.push({ message: 'Add at least one gate' });
  if (c.outputs > c.gates.length && c.gates.length > 0) {
    issues.push({ message: `${c.outputs} outputs but only ${c.gates.length} gates drive wires` });
  }
  const total = totalWires(c);
  c.gates.forEach((g, i) => {
    const own = gateWire(c.inputs, i);
    if (g.op === 'nand') {
      for (const w of [g.a, g.b]) {
        if (!wireOk(w)) issues.push({ gate: i, message: `g${i}: wire ${w} is out of range` });
        else if (w >= own) {
          issues.push({ gate: i, message: `g${i}: NAND reads wire ${w}, which is not driven yet` });
        }
      }
    } else if (g.op === 'latch') {
      if (!wireOk(g.d) || g.d >= total) {
        issues.push({ gate: i, message: `g${i}: latch input ${g.d} does not exist` });
      }
    }
  });
  return issues;
}

export interface SimResult {
  outputs: boolean[];
  nextState: boolean[];
  wires: boolean[];
}

/** Evaluate one step locally. Latches output their stored state and capture d afterwards. */
export function simulate(
  c: Circuit,
  inputs: readonly boolean[],
  state: readonly boolean[] = [],
): SimResult {
  if (c.gates.some((g) => g.op === 'ref'))
    throw new Error('Circuits that reuse other circuits run on-chain only');
  const wires: boolean[] = [false, true];
  for (let i = 0; i < c.inputs; i++) wires.push(Boolean(inputs[i]));
  let li = 0;
  for (const g of c.gates) {
    if (g.op === 'nand') wires.push(!((wires[g.a] ?? false) && (wires[g.b] ?? false)));
    else wires.push(Boolean(state[li++]));
  }
  const nextState: boolean[] = [];
  for (const g of c.gates) if (g.op === 'latch') nextState.push(wires[g.d] ?? false);
  const outputs = wires.slice(wires.length - c.outputs);
  return { outputs, nextState, wires };
}
