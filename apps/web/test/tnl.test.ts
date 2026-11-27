import { describe, expect, it } from 'vitest';
import { encodeNetlist, simulate as simBinary, validate } from '../lib/netlist';
import { type Bits, PRESETS, compile, parse, simulate, textCost, truthTable } from '../lib/tnl';

const order = (names: string[], v: Bits) => names.map((n) => Boolean(v[n]));

describe('text netlist parser', () => {
  it('parses the half adder', () => {
    const p = parse(PRESETS.halfAdder?.source ?? '');
    expect(p.errors).toEqual([]);
    expect(p.inputs).toEqual(['a', 'b']);
    expect(p.outputs).toEqual(['sum', 'carry']);
    expect(textCost(p)).toEqual({ nand: 5, latch: 0 });
  });

  it('reports useful errors with line numbers', () => {
    const p = parse('input a\nnand y a z\nfoo\nnand y a a\noutput y q');
    const msgs = p.errors.map((e) => `${e.line}:${e.message}`);
    expect(msgs).toContain('2:"z" is never driven');
    expect(msgs.some((m) => m.startsWith('3:unknown statement'))).toBe(true);
    expect(msgs).toContain('4:"y" is already driven on line 2');
    expect(msgs.some((m) => m.includes('output "q" is never driven'))).toBe(true);
  });

  it('rejects combinational loops', () => {
    const p = parse('input a\nnand x a y\nnand y a x\noutput y');
    expect(p.errors.some((e) => e.message.includes('combinational loop'))).toBe(true);
  });

  it('builds a truth table with the first input as MSB', () => {
    const rows = truthTable(parse(PRESETS.xor?.source ?? ''));
    expect(rows.map((r) => Number(r.outputs.y))).toEqual([0, 1, 1, 0]);
  });
});

describe('compile to TapeOut records', () => {
  it('keeps the XOR exactly as written (4 NAND, output already last)', () => {
    const c = compile(parse(PRESETS.xor?.source ?? ''));
    expect(c.cost).toEqual({ nand: 4, latch: 0 });
    expect(c.extra).toBe(0);
    expect(encodeNetlist(c.circuit.gates)).toBe(
      '0x00000002000003000000020000040000000300000400000005000006',
    );
  });

  it('a single NAND compiles to the record from the spike', () => {
    const c = compile(parse('input a b\nnand y a b\noutput y'));
    expect(encodeNetlist(c.circuit.gates)).toBe('0x00000002000003');
  });

  it('moves unread output gates to the end in output order', () => {
    const c = compile(parse('input a b\nnand y a b\nnand z a a\noutput z y'));
    expect(c.extra).toBe(0);
    expect(c.circuit.gates).toEqual([
      { op: 'nand', a: 2, b: 2 },
      { op: 'nand', a: 2, b: 3 },
    ]);
  });

  it('adds a mux for latch enables and buffers for latch outputs', () => {
    const c = compile(parse(PRESETS.toggle?.source ?? ''));
    expect(c.cost).toEqual({ nand: 7, latch: 1 });
    expect(c.extra).toBe(6);
    expect(c.latches).toEqual(['q']);
  });

  for (const [key, preset] of Object.entries(PRESETS)) {
    it(`compiled ${key} behaves exactly like the text netlist for 8 steps on every input`, () => {
      const p = parse(preset.source);
      const c = compile(p);
      expect(validate(c.circuit)).toEqual([]);
      for (let row = 0; row < 1 << p.inputs.length; row++) {
        const ins: Bits = Object.fromEntries(p.inputs.map((n, i) => [n, ((row >> i) & 1) === 1]));
        let text: Bits = {};
        let bin = c.latches.map(() => false);
        for (let s = 0; s < 8; s++) {
          const t = simulate(p, ins, text);
          const b = simBinary(c.circuit, order(c.inputs, ins), bin);
          expect(b.outputs).toEqual(order(c.outputs, t.outputs));
          expect(b.nextState).toEqual(order(c.latches, t.nextState));
          text = t.nextState;
          bin = b.nextState;
        }
      }
    });
  }

  it('2-bit counter counts 0, 1, 2, 3, 0', () => {
    const p = parse(PRESETS.counter?.source ?? '');
    let state: Bits = {};
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = simulate(p, {}, state);
      seen.push(Number(r.outputs.q0) + 2 * Number(r.outputs.q1));
      state = r.nextState;
    }
    expect(seen).toEqual([0, 1, 2, 3, 0]);
  });
});

describe('compile on random netlists', () => {
  // Small seeded PRNG so failures are reproducible.
  let seed = 12345;
  const rnd = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };

  it('matches the text simulator on 300 random circuits', () => {
    for (let k = 0; k < 300; k++) {
      const ins = Array.from({ length: 1 + rnd(3) }, (_, i) => `i${i}`);
      const latches = Array.from({ length: rnd(3) }, (_, i) => `q${i}`);
      const lines = [`input ${ins.join(' ')}`];
      const known = [...ins, ...latches];
      const gates: string[] = [];
      for (let g = 0; g < 2 + rnd(6); g++) {
        const name = `g${g}`;
        lines.push(`nand ${name} ${known[rnd(known.length)]} ${known[rnd(known.length)]}`);
        known.push(name);
        gates.push(name);
      }
      for (const q of latches) {
        const d = known[rnd(known.length)];
        lines.push(rnd(2) ? `latch ${q} ${d}` : `latch ${q} ${d} ${known[rnd(known.length)]}`);
      }
      const pool = [...new Set(known)];
      const outs = new Set<string>();
      const nOut = 1 + rnd(3);
      for (let i = 0; i < nOut; i++) outs.add(pool[rnd(pool.length)] as string);
      lines.push(`output ${[...outs].join(' ')}`);
      const src = lines.join('\n');
      const p = parse(src);
      expect(p.errors, src).toEqual([]);
      const c = compile(p);
      expect(validate(c.circuit), src).toEqual([]);
      for (let row = 0; row < 1 << ins.length; row++) {
        const iv: Bits = Object.fromEntries(ins.map((n, i) => [n, ((row >> i) & 1) === 1]));
        let text: Bits = {};
        let bin = c.latches.map(() => false);
        for (let s = 0; s < 4; s++) {
          const t = simulate(p, iv, text);
          const b = simBinary(c.circuit, order(c.inputs, iv), bin);
          expect(b.outputs, src).toEqual(order(c.outputs, t.outputs));
          expect(b.nextState, src).toEqual(order(c.latches, t.nextState));
          text = t.nextState;
          bin = b.nextState;
        }
      }
    }
  });
});
