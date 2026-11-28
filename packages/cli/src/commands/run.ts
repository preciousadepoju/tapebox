import { createTapeboxSdk } from '@tapebox/sdk';
import { DEFAULT_FORK_PORT } from '@tapebox/shared';
import { packBits, unpackBits } from '@tapebox/tap02';
import type { Command } from 'commander';
import pc from 'picocolors';

interface RunOpts {
  rpc: string;
  in: string;
  state?: string;
}

/** Parse a bit string like "1011" or "1,0,1 1" into booleans (input 0 first). */
function parseBits(s: string): boolean[] {
  return s
    .replace(/[\s,]/g, '')
    .split('')
    .map((ch) => {
      if (ch !== '0' && ch !== '1') throw new Error(`bits must be 0 or 1, got "${ch}"`);
      return ch === '1';
    });
}

const show = (b: boolean[]): string => b.map((x) => (x ? 1 : 0)).join('') || '-';

export function registerRun(program: Command) {
  program
    .command('run <id>')
    .description('Evaluate (or step) a taped-out circuit on a fork: inputs in, outputs out')
    .requiredOption('--in <bits>', 'input bits, input 0 first (e.g. 1011)')
    .option('--state <bits>', 'latch state bits, for stateful circuits (e.g. 01)')
    .option('--rpc <url>', 'fork RPC', `http://127.0.0.1:${DEFAULT_FORK_PORT}`)
    .action(async (idArg: string, o: RunOpts) => {
      const sdk = createTapeboxSdk({ rpcUrl: o.rpc });
      const id = BigInt(idArg);
      const info = await sdk.circuitInfo(id);
      const inBits = parseBits(o.in);
      if (inBits.length !== info.inputs) {
        throw new Error(`circuit #${id} takes ${info.inputs} inputs, got ${inBits.length}`);
      }

      if (info.latches > 0 || o.state !== undefined) {
        const stateBits = o.state
          ? parseBits(o.state)
          : new Array<boolean>(info.latches).fill(false);
        const r = await sdk.step(id, packBits(stateBits), packBits(inBits));
        const outBits = unpackBits(r.outputs, info.outputs);
        const nextBits = unpackBits(r.newState, info.latches);
        console.log(
          `${pc.bold(`#${id}`)}  state ${show(stateBits)} · in ${show(inBits)}  ${pc.dim('->')}  out ${pc.cyan(show(outBits))} · next ${show(nextBits)}`,
        );
      } else {
        const { outputs } = await sdk.eval(id, inBits, { outputs: info.outputs });
        console.log(
          `${pc.bold(`#${id}`)}  in ${show(inBits)}  ${pc.dim('->')}  out ${pc.cyan(show(outputs))}`,
        );
      }
    });
}
