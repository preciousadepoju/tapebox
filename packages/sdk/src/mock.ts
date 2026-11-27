import { type Cpu, DEFAULT_CPU, TAPEOUT_FEE_WEI } from '@tapebox/shared';
import {
  OP,
  OP_REF,
  type StatefulCircuit,
  encodeNetlist,
  loadCircuit,
  packBits,
  stepBeat,
  unpackBits,
} from '@tapebox/tap02';
import type { Hex } from 'viem';
import type { TapeboxSdk } from './types.js';

export interface MockOptions {
  cpu?: Cpu;
  /** First circuit id to hand out (default 1). */
  startId?: bigint;
}

/**
 * A chain-free SDK with the same interface as `createTapeboxSdk`. `eval` and `step` run the TAP-02
 * one-beat simulator, so Person C's playground shows real truth tables and real state transitions
 * with no fork, wallet or network. Swap in the real SDK later without touching the UI.
 *
 * This is a single-CPU mock, so it cannot resolve REF gates (which call other CPUs' circuits);
 * taping out a circuit that uses REF throws.
 */
export function createMockSdk(opts: MockOptions = {}): TapeboxSdk {
  const cpu = opts.cpu ?? DEFAULT_CPU;
  let nextId = opts.startId ?? 1n;
  const store = new Map<string, { circuit: StatefulCircuit; netlist: Hex }>();

  const must = (id: bigint) => {
    const entry = store.get(id.toString());
    if (!entry) throw new Error(`mock: no circuit #${id} (tapeOut one first)`);
    return entry;
  };

  return {
    cpu,

    async tapeOut(input) {
      const netlist = 'netlist' in input ? input.netlist : encodeNetlist(input.gates);
      // loadCircuit decodes + checks well-formedness (throws on REF here: no resolver).
      const circuit = loadCircuit(netlist, input.inputs, input.outputs);
      const id = nextId++;
      store.set(id.toString(), { circuit, netlist });
      const txHash = `0x${id.toString(16).padStart(64, '0')}` as Hex;
      return { id, txHash, netlist, inputs: circuit.nIn, outputs: circuit.nOut };
    },

    async eval(id, inputs) {
      const { circuit } = must(id);
      const bits = typeof inputs === 'string' ? unpackBits(inputs, circuit.nIn) : inputs;
      // eval == one beat from zero state (matches the on-chain view for combinational circuits).
      const { outputs } = stepBeat(circuit, new Array(circuit.nState).fill(false), bits);
      return { outputs, raw: packBits(outputs) };
    },

    async step(id, state, inputs) {
      const { circuit } = must(id);
      const r = stepBeat(
        circuit,
        unpackBits(state, circuit.nState),
        unpackBits(inputs, circuit.nIn),
      );
      return { newState: packBits(r.newState), outputs: packBits(r.outputs) };
    },

    async tapeoutFee() {
      return TAPEOUT_FEE_WEI;
    },

    async circuitInfo(id) {
      const { circuit } = must(id);
      return {
        inputs: circuit.nIn,
        outputs: circuit.nOut,
        latches: circuit.elements.filter((e) => e.op === OP.LATCH).length,
        gates: circuit.elements.filter((e) => e.op === OP.NAND || e.op === OP_REF).length,
      };
    },

    async getNetlist(id) {
      return must(id).netlist;
    },
  };
}
