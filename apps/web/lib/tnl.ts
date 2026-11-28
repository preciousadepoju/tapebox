import type { Circuit, Gate } from './netlist';

/**
 * The playground's text netlist language, one statement per line:
 *
 *   input a b            declare inputs, in order
 *   nand y a b           y = NOT (a AND b)
 *   latch q d            q holds a bit; each step it takes d
 *   latch q d en         same, but only when en is 1 (otherwise q holds)
 *   output y             declare outputs, in order
 *   # comment
 *
 * `compile()` turns it into the binary TapeOut netlist (see netlist.ts).
 */

export type Bits = Record<string, boolean>;

export interface TextGate {
  kind: 'nand' | 'latch';
  out: string;
  ins: string[];
  line: number;
}

export interface ParseError {
  line: number;
  message: string;
}

export interface Parsed {
  inputs: string[];
  outputs: string[];
  gates: TextGate[];
  order: TextGate[];
  errors: ParseError[];
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parse(source: string): Parsed {
  const inputs: string[] = [];
  const outputs: string[] = [];
  const gates: TextGate[] = [];
  const errors: ParseError[] = [];
  const driven = new Map<string, number>();
  const lines = source.split(/\r?\n/);

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    const text = raw.replace(/#.*/, '').trim();
    if (!text) return;
    const [head = '', ...args] = text.split(/\s+/);
    const op = head.toLowerCase();
    for (const a of args) {
      if (!NAME.test(a)) errors.push({ line, message: `"${a}" is not a valid signal name` });
    }
    const drive = (name: string) => {
      const prev = driven.get(name);
      if (prev !== undefined) {
        errors.push({ line, message: `"${name}" is already driven on line ${prev}` });
      } else driven.set(name, line);
    };
    switch (op) {
      case 'input':
        if (args.length === 0) errors.push({ line, message: 'input needs at least one name' });
        for (const a of args) {
          drive(a);
          inputs.push(a);
        }
        break;
      case 'output':
        if (args.length === 0) errors.push({ line, message: 'output needs at least one name' });
        outputs.push(...args);
        break;
      case 'nand':
        if (args.length !== 3) {
          errors.push({ line, message: 'nand takes exactly: <out> <a> <b>' });
          break;
        }
        drive(args[0] as string);
        gates.push({
          kind: 'nand',
          out: args[0] as string,
          ins: [args[1], args[2]] as string[],
          line,
        });
        break;
      case 'latch':
        if (args.length !== 2 && args.length !== 3) {
          errors.push({ line, message: 'latch takes: <q> <d> or <q> <d> <en>' });
          break;
        }
        drive(args[0] as string);
        gates.push({ kind: 'latch', out: args[0] as string, ins: args.slice(1), line });
        break;
      default:
        errors.push({
          line,
          message: `unknown statement "${head}" (use input, nand, latch, output)`,
        });
    }
  });

  for (const g of gates) {
    for (const i of g.ins) {
      if (!driven.has(i)) errors.push({ line: g.line, message: `"${i}" is never driven` });
    }
  }
  const seenOut = new Set<string>();
  for (const o of outputs) {
    if (!driven.has(o)) {
      const line =
        lines.findIndex((l) => /^\s*output\b/i.test(l) && l.split(/\s+/).includes(o)) + 1;
      errors.push({ line, message: `output "${o}" is never driven` });
    }
    if (seenOut.has(o)) errors.push({ line: 0, message: `output "${o}" is listed twice` });
    seenOut.add(o);
  }
  if (outputs.length === 0 && gates.length > 0) {
    errors.push({ line: lines.length, message: 'declare at least one output' });
  }
  const order = topoOrder(gates, errors);
  return { inputs, outputs, gates, order, errors };
}

/** Latches first (their q is known at the start of a step), then NANDs in dependency order. */
function topoOrder(gates: TextGate[], errors: ParseError[]): TextGate[] {
  const byOut = new Map(gates.map((g) => [g.out, g]));
  const mark = new Map<string, 1 | 2>();
  const order: TextGate[] = [];
  let reported = false;
  const visit = (g: TextGate) => {
    const m = mark.get(g.out);
    if (m === 2) return;
    if (m === 1) {
      if (!reported) {
        errors.push({
          line: g.line,
          message: `combinational loop through "${g.out}". Break it with a latch.`,
        });
        reported = true;
      }
      return;
    }
    mark.set(g.out, 1);
    if (g.kind === 'nand') {
      for (const i of g.ins) {
        const dep = byOut.get(i);
        if (dep && dep.kind === 'nand') visit(dep);
      }
    }
    mark.set(g.out, 2);
    order.push(g);
  };
  for (const g of gates) if (g.kind === 'latch') visit(g);
  for (const g of gates) if (g.kind === 'nand') visit(g);
  return order;
}

function values(p: Parsed, inputs: Bits, state: Bits): Bits {
  if (p.errors.length) throw new Error(`netlist has errors: ${p.errors[0]?.message}`);
  const v: Bits = {};
  for (const i of p.inputs) v[i] = Boolean(inputs[i]);
  for (const g of p.order) if (g.kind === 'latch') v[g.out] = Boolean(state[g.out]);
  for (const g of p.order) {
    if (g.kind === 'nand') v[g.out] = !(v[g.ins[0] as string] && v[g.ins[1] as string]);
  }
  return v;
}

export interface SimStep {
  values: Bits;
  outputs: Bits;
  nextState: Bits;
}

/** One step: outputs from the current state, then every latch captures its input. */
export function simulate(p: Parsed, inputs: Bits, state: Bits = {}): SimStep {
  const v = values(p, inputs, state);
  const outputs = Object.fromEntries(p.outputs.map((o) => [o, Boolean(v[o])]));
  const nextState: Bits = {};
  for (const g of p.gates) {
    if (g.kind !== 'latch') continue;
    const [d, en] = g.ins as [string, string | undefined];
    nextState[g.out] = en === undefined || v[en] ? Boolean(v[d]) : Boolean(state[g.out]);
  }
  return { values: v, outputs, nextState };
}

export interface TruthRow {
  inputs: Bits;
  outputs: Bits;
}

/** Every input combination (first input is the most significant), latches at reset. */
export function truthTable(p: Parsed, maxInputs = 6): TruthRow[] {
  if (p.inputs.length > maxInputs) return [];
  const rows: TruthRow[] = [];
  const n = p.inputs.length;
  for (let r = 0; r < 1 << n; r++) {
    const ins: Bits = {};
    p.inputs.forEach((name, i) => {
      ins[name] = ((r >> (n - 1 - i)) & 1) === 1;
    });
    rows.push({ inputs: ins, outputs: simulate(p, ins).outputs });
  }
  return rows;
}

export function textCost(p: Parsed) {
  let nand = 0;
  let latch = 0;
  for (const g of p.gates) g.kind === 'nand' ? nand++ : latch++;
  return { nand, latch };
}

export interface Compiled {
  circuit: Circuit;
  /** Latch names in state-bit order. */
  latches: string[];
  inputs: string[];
  outputs: string[];
  cost: { nand: number; latch: number };
  /** NANDs added for enables and output routing, on top of the ones written. */
  extra: number;
}

/**
 * Lay the text netlist out as TapeOut records: wires 0/1 are constants, inputs follow, latches come
 * next (so NANDs can read their q), then NANDs in dependency order. A latch with an enable gets a
 * 4-NAND mux in front of it. Outputs must be the last wires, so output gates nothing else reads are
 * moved to the end; any other output gets a 2-NAND buffer.
 */
export function compile(p: Parsed): Compiled {
  if (p.errors.length) throw new Error(`netlist has errors: ${p.errors[0]?.message}`);
  const wire = new Map<string, number>();
  p.inputs.forEach((name, i) => wire.set(name, 2 + i));
  const records: Gate[] = [];
  const names: (string | null)[] = [];
  const next = () => 2 + p.inputs.length + records.length;
  const push = (g: Gate, name: string | null) => {
    const w = next();
    records.push(g);
    names.push(name);
    if (name) wire.set(name, w);
    return w;
  };

  const latches = p.order.filter((g) => g.kind === 'latch');
  const nands = p.order.filter((g) => g.kind === 'nand');

  // Output gates nobody else reads can simply be emitted last, in output order.
  const readers = new Map<string, number>();
  for (const g of p.gates) for (const i of g.ins) readers.set(i, (readers.get(i) ?? 0) + 1);
  const byOut = new Map(p.gates.map((g) => [g.out, g]));
  const movable = p.outputs.every((o) => byOut.get(o)?.kind === 'nand' && !readers.get(o));
  const tail = movable ? p.outputs.map((o) => byOut.get(o) as TextGate) : [];
  const tailSet = new Set(tail.map((g) => g.out));

  const latchRecords: { gate: TextGate; index: number }[] = [];
  for (const l of latches) {
    latchRecords.push({ gate: l, index: records.length });
    push({ op: 'latch', d: 0 }, l.out);
  }
  for (const g of nands) {
    if (tailSet.has(g.out)) continue;
    push(
      { op: 'nand', a: wire.get(g.ins[0] as string) ?? 0, b: wire.get(g.ins[1] as string) ?? 0 },
      g.out,
    );
  }
  let extra = 0;
  for (const { gate, index } of latchRecords) {
    const d = wire.get(gate.ins[0] as string) ?? 0;
    let target = d;
    if (gate.ins.length === 2) {
      const en = wire.get(gate.ins[1] as string) ?? 0;
      const q = wire.get(gate.out) ?? 0;
      const nen = push({ op: 'nand', a: en, b: en }, null);
      const x = push({ op: 'nand', a: d, b: en }, null);
      const y = push({ op: 'nand', a: q, b: nen }, null);
      target = push({ op: 'nand', a: x, b: y }, null);
      extra += 4;
    }
    records[index] = { op: 'latch', d: target };
  }
  if (movable) {
    for (const g of tail) {
      push(
        { op: 'nand', a: wire.get(g.ins[0] as string) ?? 0, b: wire.get(g.ins[1] as string) ?? 0 },
        g.out,
      );
    }
  } else {
    const last = names.slice(names.length - p.outputs.length);
    const already = p.outputs.length <= names.length && p.outputs.every((o, i) => last[i] === o);
    if (!already) {
      // Invert every output first, then invert again, so the outputs land on the last wires in order.
      const inverted = p.outputs.map((o) => {
        const src = wire.get(o) ?? 0;
        return push({ op: 'nand', a: src, b: src }, null);
      });
      for (const inv of inverted) push({ op: 'nand', a: inv, b: inv }, null);
      extra += 2 * p.outputs.length;
    }
  }

  let nandCount = 0;
  for (const r of records) if (r.op === 'nand') nandCount++;
  return {
    circuit: { inputs: p.inputs.length, outputs: p.outputs.length, gates: records },
    latches: latches.map((l) => l.out),
    inputs: p.inputs,
    outputs: p.outputs,
    cost: { nand: nandCount, latch: latches.length },
    extra,
  };
}

export const PRESETS: Record<string, { title: string; source: string }> = {
  not: {
    title: 'NOT (1 NAND)',
    source: `# The smallest chip: a NAND with both inputs tied
input a
nand y a a
output y
`,
  },
  xor: {
    title: 'XOR (4 NAND)',
    source: `# XOR from four NAND gates
input a b
nand n1 a b
nand n2 a n1
nand n3 b n1
nand y  n2 n3
output y
`,
  },
  halfAdder: {
    title: 'Half adder (5 NAND)',
    source: `# sum = a XOR b, carry = a AND b
input a b
nand n1 a b
nand n2 a n1
nand n3 b n1
nand sum n2 n3
nand carry n1 n1
output sum carry
`,
  },
  toggle: {
    title: 'Toggle flip-flop (1 NAND + 1 LATCH)',
    source: `# q flips every beat while t is 1
input t
nand nq q q
latch q nq t
output q
`,
  },
  counter: {
    title: '2-bit counter (2 LATCH)',
    source: `# counts 0, 1, 2, 3 on every beat
nand n0 q0 q0
nand x1 q0 q1
nand x2 q0 x1
nand x3 q1 x1
nand d1 x2 x3
latch q0 n0
latch q1 d1
output q0 q1
`,
  },
};
