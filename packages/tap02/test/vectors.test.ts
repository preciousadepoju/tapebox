import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import { type Circuit, assertWellFormed, decodeNetlist } from '../src/netlist.js';
import { evalBeat, packBits, unpackBits } from '../src/simulate.js';
import { type Resolve, loadCircuit, stepBeat } from '../src/stateful.js';

/**
 * The official TAP-02 conformance vectors, vendored from TapeOutProtocol/TAPs
 * (assets/tap-02/vectors.json). Covered: combinational (NAND-only) truth tables, every ill-formed
 * case, bit-packing edge cases, and the stateful (LATCH/REF) beat sequences.
 */
interface Row {
  inputs: string;
  outputs: string;
}
interface Ref {
  cpu: string;
  id: number;
  nIn: number;
  nOut: number;
  netlist: string;
}
interface Beat {
  state: string;
  inputs: string;
  newState: string;
  outputs: string;
}
interface Valid {
  name: string;
  nIn: number;
  nOut: number;
  nState: number;
  netlist: string;
  truthTable?: Row[];
  beats?: Beat[];
  refs?: Ref[];
}
interface IllFormed {
  name: string;
  nIn: number;
  nOut: number;
  netlist: string;
  reason: string;
}
interface Vectors {
  format: string;
  valid: Valid[];
  illFormed: IllFormed[];
  packingEdgeCases: { circuit: string; cases: { case: string; inputs: string; outputs: string }[] };
}

const V: Vectors = JSON.parse(
  readFileSync(fileURLToPath(new URL('../vectors/vectors.json', import.meta.url)), 'utf8'),
);

const hex = (s: string): Hex => (s.startsWith('0x') ? s : `0x${s}`) as Hex;
const circuitOf = (v: { nIn: number; nOut: number; netlist: string }): Circuit => ({
  inputs: v.nIn,
  outputs: v.nOut,
  gates: decodeNetlist(hex(v.netlist)),
});

const combinational = V.valid.filter((v) => v.nState === 0 && v.truthTable);

describe('official TAP-02 vectors — valid combinational truth tables', () => {
  for (const v of combinational) {
    it(`${v.name} (${v.truthTable?.length} rows)`, () => {
      const circuit = circuitOf(v);
      assertWellFormed(circuit);
      for (const row of v.truthTable ?? []) {
        const out = evalBeat(circuit, unpackBits(hex(row.inputs), v.nIn));
        expect(packBits(out), `inputs ${row.inputs}`).toBe(hex(row.outputs));
      }
    });
  }
});

describe('official TAP-02 vectors — ill-formed netlists are rejected', () => {
  for (const v of V.illFormed) {
    it(`${v.name}: ${v.reason}`, () => {
      // Rejection happens either in decode (length/truncation) or in the well-formedness check.
      expect(() => assertWellFormed(circuitOf(v))).toThrow();
    });
  }
});

describe('official TAP-02 vectors — bit-packing edge cases', () => {
  const base = combinational.find((v) => v.name === V.packingEdgeCases.circuit);
  const circuit = base ? circuitOf(base) : undefined;
  for (const c of V.packingEdgeCases.cases) {
    it(`${c.case} (in ${c.inputs || '∅'})`, () => {
      if (!circuit) throw new Error(`packing circuit ${V.packingEdgeCases.circuit} not found`);
      const out = evalBeat(circuit, unpackBits(hex(c.inputs), circuit.inputs));
      expect(packBits(out)).toBe(hex(c.outputs));
    });
  }
});

// Resolve REF targets from a vector's `refs`, recursively (a ref may reference further refs).
function makeResolve(refs: Ref[]): Resolve {
  const resolve: Resolve = (cpu, cid) => {
    const r = refs.find((x) => x.cpu.toLowerCase() === cpu.toLowerCase() && BigInt(x.id) === cid);
    return r ? loadCircuit(hex(r.netlist), r.nIn, r.nOut, resolve) : undefined;
  };
  return resolve;
}

const stateful = V.valid.filter((v): v is Valid & { beats: Beat[] } => Array.isArray(v.beats));

describe('official TAP-02 vectors — stateful beat sequences', () => {
  for (const v of stateful) {
    it(`${v.name} (${v.beats.length} beats, nState ${v.nState})`, () => {
      const circuit = loadCircuit(hex(v.netlist), v.nIn, v.nOut, makeResolve(v.refs ?? []));
      expect(circuit.nState).toBe(v.nState);
      for (const b of v.beats) {
        const r = stepBeat(
          circuit,
          unpackBits(hex(b.state), v.nState),
          unpackBits(hex(b.inputs), v.nIn),
        );
        const where = `state ${b.state} in ${b.inputs}`;
        expect(packBits(r.outputs), where).toBe(hex(b.outputs));
        expect(packBits(r.newState), where).toBe(hex(b.newState));
      }
    });
  }
});
