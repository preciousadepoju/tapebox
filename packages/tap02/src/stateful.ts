import { type Hex, bytesToHex, hexToBytes } from 'viem';
import { FIRST_INPUT_WIRE, MAX_WIRE, OP } from './netlist.js';

/**
 * Stateful one-beat semantics, a faithful port of the TAP-02 reference evaluator (reference.py).
 *
 * The combinational path in `simulate.ts` (`evalBeat`) only knows NAND. This module adds the full
 * element model needed for state and composition:
 *   - LATCH (op 0x01): one input `d`; outputs last beat's held value, captures `d` for next beat.
 *     Its `d` may reference any in-range wire, including later ones (feedback).
 *   - REF   (op 0x02): calls another circuit by (cpu, id); has its own nested state.
 * Records are therefore variable length (NAND 7 bytes, LATCH 4 bytes, REF 31 + 3·nIn bytes).
 */

export const MAX_PINS = 1 << 16;

/** REF opcode — kept out of the combinational `OP` map, which only models NAND/LATCH. */
export const OP_REF = 0x02;

export class IllFormed extends Error {}

export interface Element {
  op: number;
  /** NAND: [a, b]; LATCH: [d]; REF: input wires. */
  ins: number[];
  /** REF only: 20-byte processor address. */
  cpu?: Hex;
  /** REF only: circuit id. */
  cid?: bigint;
  /** Number of signals produced (1 for NAND/LATCH; REF's nOut). */
  nOut: number;
  /** Index of the first signal this element drives. */
  firstOut: number;
}

export interface StatefulCircuit {
  nIn: number;
  nOut: number;
  elements: Element[];
  nSignals: number;
  nState: number;
  /** State slice offset for each element, parallel to `elements`. */
  stateBase: number[];
  /** Resolved REF targets, keyed `${cpu}:${cid}`. */
  subs: Map<string, StatefulCircuit>;
}

export type Resolve = (cpu: Hex, cid: bigint) => StatefulCircuit | undefined;

const subKey = (cpu: Hex, cid: bigint): string => `${cpu.toLowerCase()}:${cid}`;

/** Decode a netlist into elements (variable-length records). `nIn` sets where signal numbering starts. */
export function decodeElements(netlist: Hex, nIn: number): Element[] {
  const data = hexToBytes(netlist);
  let p = 0;
  let nxt = FIRST_INPUT_WIRE + nIn;
  const take = (k: number): Uint8Array => {
    if (p + k > data.length) throw new IllFormed(`truncated record at byte ${p}`);
    const b = data.subarray(p, p + k);
    p += k;
    return b;
  };
  const u24 = (): number => {
    const b = take(3);
    return (b[0] << 16) | (b[1] << 8) | b[2];
  };
  const els: Element[] = [];
  while (p < data.length) {
    const op = take(1)[0];
    let el: Element;
    if (op === OP.NAND) {
      el = { op, ins: [u24(), u24()], nOut: 1, firstOut: 0 };
    } else if (op === OP.LATCH) {
      el = { op, ins: [u24()], nOut: 1, firstOut: 0 };
    } else if (op === OP_REF) {
      const cpu = bytesToHex(take(20));
      let cid = 0n;
      for (const byte of take(8)) cid = (cid << 8n) | BigInt(byte);
      const ni = take(1)[0];
      const no = take(1)[0];
      el = { op, ins: Array.from({ length: ni }, () => u24()), cpu, cid, nOut: no, firstOut: 0 };
    } else {
      throw new IllFormed(`unknown opcode 0x${op.toString(16).padStart(2, '0')} at byte ${p - 1}`);
    }
    el.firstOut = nxt;
    nxt += el.nOut;
    els.push(el);
  }
  return els;
}

/** Decode and run the full well-formedness check (TAP-02 §3). `resolve` supplies REF targets. */
export function loadCircuit(
  netlist: Hex,
  nIn: number,
  nOut: number,
  resolve?: Resolve,
): StatefulCircuit {
  const elements = decodeElements(netlist, nIn);
  const nSignals = FIRST_INPUT_WIRE + nIn + elements.reduce((n, e) => n + e.nOut, 0);
  if (nSignals - 1 > MAX_WIRE) throw new IllFormed('more than 2^24 signals');
  if (!(nIn >= 0 && nIn <= MAX_PINS && nOut >= 1 && nOut <= MAX_PINS)) {
    throw new IllFormed('nIn/nOut out of range');
  }
  if (nSignals - FIRST_INPUT_WIRE - nIn < nOut) throw new IllFormed('too few signals for outputs');

  const subs = new Map<string, StatefulCircuit>();
  const stateBase: number[] = [];
  let nState = 0;
  for (const e of elements) {
    for (const s of e.ins) {
      const limit = e.op === OP.LATCH ? nSignals : e.firstOut;
      if (s < 0 || s >= limit) {
        throw new IllFormed(`signal ${s} referenced by element at ${e.firstOut} is not available`);
      }
    }
    stateBase.push(nState);
    if (e.op === OP.LATCH) {
      nState += 1;
    } else if (e.op === OP_REF) {
      if (!resolve) throw new IllFormed('REF without a resolver');
      const sub = resolve(e.cpu as Hex, e.cid as bigint);
      if (!sub) throw new IllFormed('REF target is not a circuit of a registered processor');
      if (sub.nIn !== e.ins.length || sub.nOut !== e.nOut) {
        throw new IllFormed('REF arity does not match the target circuit');
      }
      subs.set(subKey(e.cpu as Hex, e.cid as bigint), sub);
      nState += sub.nState;
    }
  }
  return { nIn, nOut, elements, nSignals, nState, stateBase, subs };
}

/** One beat (TAP-02 §4): (state, inputs) -> (newState, outputs), as bit arrays. */
export function stepBeat(
  c: StatefulCircuit,
  state: boolean[],
  inputs: boolean[],
): { newState: boolean[]; outputs: boolean[] } {
  if (state.length !== c.nState)
    throw new Error(`expected ${c.nState} state bits, got ${state.length}`);
  if (inputs.length !== c.nIn)
    throw new Error(`expected ${c.nIn} input bits, got ${inputs.length}`);

  const a: number[] = [0, 1, ...inputs.map((b) => (b ? 1 : 0))];
  const s: number[] = state.map((b) => (b ? 1 : 0));
  const newState: number[] = [...s];

  c.elements.forEach((e, k) => {
    const base = c.stateBase[k];
    if (e.op === OP.NAND) {
      a.push(1 - (a[e.ins[0]] & a[e.ins[1]]));
    } else if (e.op === OP.LATCH) {
      a.push(s[base]);
    } else {
      const sub = c.subs.get(subKey(e.cpu as Hex, e.cid as bigint));
      if (!sub) throw new Error('REF target was not resolved at load time');
      const subState = state.slice(base, base + sub.nState);
      const subIn = e.ins.map((sig) => a[sig] === 1);
      const r = stepBeat(sub, subState, subIn);
      for (let i = 0; i < sub.nState; i++) newState[base + i] = r.newState[i] ? 1 : 0;
      for (const o of r.outputs) a.push(o ? 1 : 0);
    }
  });

  // LATCHes capture their d only after all elements have been evaluated this beat.
  c.elements.forEach((e, k) => {
    if (e.op === OP.LATCH) newState[c.stateBase[k]] = a[e.ins[0]];
  });

  return {
    newState: newState.map((x) => x === 1),
    outputs: a.slice(a.length - c.nOut).map((x) => x === 1),
  };
}

export interface NetlistSummary {
  /** Number of records (gates) in the netlist. */
  records: number;
  nand: number;
  latch: number;
  ref: number;
  /** Total signals: 2 constants + inputs + one per produced wire. */
  signals: number;
  /** True if the circuit has state (LATCH) or composition (REF). */
  stateful: boolean;
}

/** Decode a netlist and summarize its composition (no chain needed). */
export function summarize(netlist: Hex, nIn: number): NetlistSummary {
  const els = decodeElements(netlist, nIn);
  let nand = 0;
  let latch = 0;
  let ref = 0;
  let produced = 0;
  for (const e of els) {
    if (e.op === OP.NAND) nand++;
    else if (e.op === OP.LATCH) latch++;
    else if (e.op === OP_REF) ref++;
    produced += e.nOut;
  }
  return {
    records: els.length,
    nand,
    latch,
    ref,
    signals: FIRST_INPUT_WIRE + nIn + produced,
    stateful: latch > 0 || ref > 0,
  };
}
