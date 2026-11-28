// Copy to `tapebox.config.ts`, then run `tapebox test` (or `tapebox test --mock`).
// Optionally: `import { defineConfig } from 'tapebox'` for typed authoring.
export default {
  // rpc: 'http://127.0.0.1:8545',   // omit to use --rpc, or --mock for no fork
  tests: [
    {
      name: 'NAND',
      circuit: { inputs: 2, outputs: 1, gates: [{ op: 0, a: 2, b: 3 }] }, // op 0 = NAND
      truthTable: [
        { in: [0, 0], out: [1] },
        { in: [1, 0], out: [1] },
        { in: [0, 1], out: [1] },
        { in: [1, 1], out: [0] },
      ],
    },
    {
      // A stateful circuit (LATCH) needs the netlist form; checked with `beats` via step().
      name: 'toggle',
      circuit: {
        netlist: '0x0100000700000003000002000000030000040000000200000400000005000006',
        inputs: 1,
        outputs: 1,
      },
      beats: [
        { state: [0], in: [1], out: [1], newState: [1] }, // t=1 flips 0 -> 1
        { state: [1], in: [1], out: [0], newState: [0] }, // t=1 flips 1 -> 0
        { state: [0], in: [0], out: [0], newState: [0] }, // t=0 holds
      ],
    },
  ],
};
