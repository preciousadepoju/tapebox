import type { NetlistInput, TapeboxSdk } from '@tapebox/sdk';
import type { Op } from '@tapebox/tap02';
import type { Hex } from 'viem';
import type { TapeboxConfig } from './config.js';
import type { CaseResult, CheckResult, RunReport } from './report.js';

type ConfigCircuit = TapeboxConfig['tests'][number]['circuit'];

const toBool = (b: 0 | 1 | boolean): boolean => b === true || b === 1;
const eqBits = (a: boolean[], b: boolean[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

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

/** Tape out every circuit in the config and check its truth table through the given SDK. */
export async function runSuite(
  sdk: TapeboxSdk,
  config: TapeboxConfig,
  version: string,
): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const cases: CaseResult[] = [];

  for (const t of config.tests) {
    const c0 = Date.now();
    try {
      const { id, netlist } = await sdk.tapeOut(toNetlistInput(t.circuit));
      const checks: CheckResult[] = [];
      for (const row of t.truthTable ?? []) {
        const inBits = row.in.map(toBool);
        const expected = row.out.map(toBool);
        const { outputs } = await sdk.eval(id, inBits);
        checks.push({
          name: `in ${inBits.map((b) => (b ? 1 : 0)).join('')}`,
          expected,
          actual: outputs,
          pass: eqBits(outputs, expected),
        });
      }
      cases.push({
        name: t.name,
        circuitId: id.toString(),
        netlist,
        checks,
        pass: checks.every((c) => c.pass),
        durationMs: Date.now() - c0,
      });
    } catch (e) {
      cases.push({
        name: t.name,
        checks: [],
        pass: false,
        durationMs: Date.now() - c0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const passed = cases.filter((c) => c.pass).length;
  return {
    tool: 'tapebox',
    version,
    startedAt,
    durationMs: Date.now() - t0,
    total: cases.length,
    passed,
    failed: cases.length - passed,
    cases,
  };
}
