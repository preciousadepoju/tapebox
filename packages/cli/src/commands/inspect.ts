import { createTapeboxSdk } from '@tapebox/sdk';
import { DEFAULT_FORK_PORT } from '@tapebox/shared';
import { type Circuit, decodeNetlist, evalBeat, summarize } from '@tapebox/tap02';
import type { Command } from 'commander';
import pc from 'picocolors';
import type { Hex } from 'viem';

interface InspectOpts {
  inputs?: string;
  outputs?: string;
  rpc: string;
  id?: string;
  table?: boolean;
}

export function registerInspect(program: Command) {
  program
    .command('inspect [netlist]')
    .description('Decode a circuit (a netlist hex, or one on a fork via --id) into its parts')
    .option('--inputs <n>', 'number of inputs (required for a given netlist)')
    .option('--outputs <m>', 'number of outputs (for a given netlist)', '1')
    .option('--rpc <url>', 'fork RPC to fetch from', `http://127.0.0.1:${DEFAULT_FORK_PORT}`)
    .option('--id <circuitId>', 'fetch the circuit with this id from the fork')
    .option('--table', 'print the truth table (combinational circuits only)')
    .action(async (netlistArg: string | undefined, o: InspectOpts) => {
      let netlist: Hex;
      let inputs: number;
      let outputs: number;

      if (o.id) {
        const sdk = createTapeboxSdk({ rpcUrl: o.rpc });
        const id = BigInt(o.id);
        netlist = await sdk.getNetlist(id);
        const info = await sdk.circuitInfo(id);
        inputs = info.inputs;
        outputs = info.outputs;
      } else {
        if (!netlistArg)
          throw new Error('provide a netlist, or use --id (with --rpc) to fetch one');
        if (o.inputs === undefined) throw new Error('--inputs is required for a given netlist');
        netlist = (netlistArg.startsWith('0x') ? netlistArg : `0x${netlistArg}`) as Hex;
        inputs = Number(o.inputs);
        outputs = Number(o.outputs);
      }

      const s = summarize(netlist, inputs);
      const label = o.id ? `#${o.id}` : `${netlist.slice(0, 26)}${netlist.length > 26 ? '…' : ''}`;
      console.log(`${pc.bold('circuit')}  ${label}`);
      console.log(`  inputs ${inputs}  outputs ${outputs}  signals ${s.signals}`);
      console.log(`  gates  ${s.records}  (${s.nand} NAND, ${s.latch} LATCH, ${s.ref} REF)`);
      console.log(`  ${s.stateful ? pc.yellow('stateful') : pc.green('combinational')}`);

      if (o.table) {
        if (s.stateful) {
          console.log(pc.dim('  (truth table is shown for combinational circuits only)'));
          return;
        }
        if (inputs > 12) {
          console.log(pc.dim(`  (${inputs} inputs is too many to tabulate)`));
          return;
        }
        const circuit: Circuit = { inputs, outputs, gates: decodeNetlist(netlist) };
        console.log(`\n  ${'in'.padEnd(Math.max(inputs, 2))}  out`);
        for (let row = 0; row < 1 << inputs; row++) {
          const inBits = Array.from({ length: inputs }, (_, i) => ((row >> i) & 1) === 1);
          const out = evalBeat(circuit, inBits);
          console.log(
            `  ${inBits
              .map((b) => (b ? 1 : 0))
              .join('')
              .padEnd(Math.max(inputs, 2))}  ${out.map((b) => (b ? 1 : 0)).join('')}`,
          );
        }
      }
    });
}
