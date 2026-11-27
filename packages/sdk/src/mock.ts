import { type Cpu, DEFAULT_CPU, TAPEOUT_FEE_WEI } from '@tapebox/shared';
import {
  type Circuit,
  assertWellFormed,
  decodeNetlist,
  encodeNetlist,
  evalBeat,
  packBits,
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
 * A chain-free SDK with the same interface as `createTapeboxSdk`. `eval` returns the *correct*
 * answer by running the TAP-02 one-beat simulator, so Person C's playground shows real truth
 * tables with no fork, wallet or network. Swap in the real SDK later without touching the UI.
 */
export function createMockSdk(opts: MockOptions = {}): TapeboxSdk {
  const cpu = opts.cpu ?? DEFAULT_CPU;
  let nextId = opts.startId ?? 1n;
  const store = new Map<string, { circuit: Circuit; netlist: Hex }>();

  const must = (id: bigint) => {
    const entry = store.get(id.toString());
    if (!entry) throw new Error(`mock: no circuit #${id} (tapeOut one first)`);
    return entry;
  };

  return {
    cpu,

    async tapeOut(input) {
      const circuit: Circuit =
        'gates' in input
          ? input
          : { inputs: input.inputs, outputs: input.outputs, gates: decodeNetlist(input.netlist) };
      assertWellFormed(circuit);
      const netlist = 'netlist' in input ? input.netlist : encodeNetlist(circuit.gates);
      const id = nextId++;
      store.set(id.toString(), { circuit, netlist });
      const txHash = `0x${id.toString(16).padStart(64, '0')}` as Hex;
      return { id, txHash, netlist, inputs: circuit.inputs, outputs: circuit.outputs };
    },

    async eval(id, inputs) {
      const { circuit } = must(id);
      const bits = typeof inputs === 'string' ? unpackBits(inputs, circuit.inputs) : inputs;
      const outputs = evalBeat(circuit, bits);
      return { outputs, raw: packBits(outputs) };
    },

    async step() {
      throw new Error('mock step() is not implemented yet (LATCH semantics pending vectors)');
    },

    async tapeoutFee() {
      return TAPEOUT_FEE_WEI;
    },

    async circuitInfo(id) {
      const { circuit } = must(id);
      return {
        inputs: circuit.inputs,
        outputs: circuit.outputs,
        latches: 0,
        gates: circuit.gates.length,
      };
    },

    async getNetlist(id) {
      return must(id).netlist;
    },
  };
}
