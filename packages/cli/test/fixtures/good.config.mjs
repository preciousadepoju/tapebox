export default {
  tests: [
    {
      name: 'NAND',
      circuit: { inputs: 2, outputs: 1, gates: [{ op: 0, a: 2, b: 3 }] },
      truthTable: [
        { in: [0, 0], out: [1] },
        { in: [1, 1], out: [0] },
      ],
    },
  ],
};
