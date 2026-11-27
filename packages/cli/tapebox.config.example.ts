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
  ],
};
