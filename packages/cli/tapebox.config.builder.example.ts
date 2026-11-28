// A circuit built in code with @tapebox/tap02's CircuitBuilder — no hand-written netlist bytes —
// and checked by `tapebox test`. Run: tapebox test --mock --config tapebox.config.builder.example.ts
import { CircuitBuilder } from '@tapebox/tap02';

const b = new CircuitBuilder(2);
const [a, c] = b.inputWires;
const { sum, carry } = b.halfAdder(a, c);
const halfAdder = b.build([sum, carry]); // outputs: [sum, carry]

export default {
  tests: [
    {
      name: 'half adder',
      circuit: halfAdder,
      truthTable: [
        { in: [0, 0], out: [0, 0] }, // 0 + 0 -> sum 0, carry 0
        { in: [1, 0], out: [1, 0] }, // 1 + 0 -> sum 1, carry 0
        { in: [0, 1], out: [1, 0] }, // 0 + 1 -> sum 1, carry 0
        { in: [1, 1], out: [0, 1] }, // 1 + 1 -> sum 0, carry 1
      ],
    },
  ],
};
