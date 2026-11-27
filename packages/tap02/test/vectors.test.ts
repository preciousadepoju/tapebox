import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import { type Circuit, assertWellFormed, decodeNetlist } from '../src/netlist.js';
import { evalBeat, packBits, unpackBits } from '../src/simulate.js';

/**
 * The official TAP-02 conformance vectors, vendored from TapeOutProtocol/TAPs
 * (assets/tap-02/vectors.json). The scaffold covers the combinational (NAND-only, nState 0)
 * circuits and every ill-formed case; stateful LATCH/REF circuits have no truth table and are
 * left for the step() path (see vectors/README.md).
 */
interface Row {
  inputs: string;
  outputs: string;
}
interface Valid {
  name: string;
  nIn: number;
  nOut: number;
  nState: number;
  netlist: string;
  truthTable?: Row[];
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
