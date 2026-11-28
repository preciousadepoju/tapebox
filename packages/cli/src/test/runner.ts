import type { NetlistInput, TapeboxSdk } from '@tapebox/sdk';
import type { Bits, Report, ReportCase, ReportSuite } from '@tapebox/shared';
import { OP, type Op, decodeElements } from '@tapebox/tap02';
import type { Hex } from 'viem';
import type { TapeboxConfig } from './config.js';

type ConfigCircuit = TapeboxConfig['tests'][number]['circuit'];

const toBool = (b: 0 | 1 | boolean): boolean => b === true || b === 1;
const eqBits = (a: boolean[], b: boolean[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Positional signals get synthetic names so the report matches the website's named-bits schema. */
const named = (prefix: string, bits: boolean[]): Bits =>
  Object.fromEntries(bits.map((b, i) => [`${prefix}${i}`, b]));

/** Config circuits use plain numbers for ops; the SDK/tap02 types want the Op union. */
function toNetlistInput(c: ConfigCircuit): NetlistInput {
  if ('gates' in c) {
    return {
      inputs: c.inputs,
      outputs: c.outputs,
      gates: c.gates.map((g) => ({ op: g.op as Op, a: g.a, b: g.b })),
    };
  }
  // zod validates the 0x-hex shape at runtime; narrow the inferred `string` to Hex here.
  return { netlist: c.netlist as Hex, inputs: c.inputs, outputs: c.outputs };
}

/** Count NAND and LATCH records in a taped-out netlist (REF counts toward neither). */
function gateCounts(netlist: Hex, inputs: number): { nand: number; latch: number } {
  try {
    const els = decodeElements(netlist, inputs);
    return {
      nand: els.filter((e) => e.op === OP.NAND).length,
      latch: els.filter((e) => e.op === OP.LATCH).length,
    };
  } catch {
    return { nand: 0, latch: 0 };
  }
}

export interface RunOptions {
  version: string;
  mode: 'mock' | 'fork' | 'mainnet';
  chainId: number;
  forkBlock?: number;
}

/** Tape out every circuit in the config, check its truth table, and build the shared Report. */
export async function runSuite(
  sdk: TapeboxSdk,
  config: TapeboxConfig,
  opts: RunOptions,
): Promise<Report> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const suites: ReportSuite[] = [];

  for (const t of config.tests) {
    const input = toNetlistInput(t.circuit);
    try {
      const { id, netlist } = await sdk.tapeOut(input);
      const cases: ReportCase[] = [];
      for (const row of t.truthTable ?? []) {
        const c0 = Date.now();
        const inBits = row.in.map(toBool);
        const expected = row.out.map(toBool);
        const { outputs } = await sdk.eval(id, inBits);
        cases.push({
          name: `in ${inBits.map((b) => (b ? 1 : 0)).join('') || '-'}`,
          kind: 'truthTable',
          status: eqBits(outputs, expected) ? 'passed' : 'failed',
          durationMs: Date.now() - c0,
          inputs: named('in', inBits),
          expected: named('out', expected),
          actual: named('out', outputs),
        });
      }
      suites.push({
        name: t.name,
        circuit: netlist,
        circuitId: id.toString(),
        gates: gateCounts(netlist, input.inputs),
        cases,
      });
    } catch (e) {
      suites.push({
        name: t.name,
        circuit: 'netlist' in input ? input.netlist : '',
        gates: { nand: 0, latch: 0 },
        cases: [
          {
            name: 'tape out',
            kind: 'truthTable',
            status: 'failed',
            durationMs: 0,
            inputs: {},
            expected: {},
            message: e instanceof Error ? e.message : String(e),
          },
        ],
      });
    }
  }

  const all = suites.flatMap((s) => s.cases);
  const summary = {
    passed: all.filter((c) => c.status === 'passed').length,
    failed: all.filter((c) => c.status === 'failed').length,
    skipped: all.filter((c) => c.status === 'skipped').length,
  };

  return {
    tool: 'tapebox',
    schemaVersion: 1,
    version: opts.version,
    startedAt,
    durationMs: Date.now() - t0,
    chain: {
      mode: opts.mode,
      chainId: opts.chainId,
      ...(opts.forkBlock ? { forkBlock: opts.forkBlock } : {}),
    },
    summary,
    suites,
  };
}
