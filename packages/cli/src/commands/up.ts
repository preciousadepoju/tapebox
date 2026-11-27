import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fund, startFork } from '@tapebox/fork';
import { DEFAULT_CPU, DEFAULT_FORK_PORT, FORK_BLOCK } from '@tapebox/shared';
import type { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import { type Address, formatEther, isAddress } from 'viem';

interface UpOpts {
  port: string;
  host: string;
  rpc?: string;
  block: string;
  state?: string;
  dump?: string;
  fund: string[];
  verbose?: boolean;
}

// anvil's well-known dev accounts 0 and 1, funded with transistors on start for instant use.
const DEV_ACCOUNTS: Address[] = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7f2b0b0aA2f8F1d5C2',
];

export function registerUp(program: Command) {
  program
    .command('up')
    .description('Start a local X Layer mainnet fork with the real TapeOut contracts')
    .option('-p, --port <port>', 'local RPC port', String(DEFAULT_FORK_PORT))
    .option('--host <host>', 'interface to bind', '127.0.0.1')
    .option('--rpc <url>', 'upstream X Layer RPC (default: first that answers)')
    .option('--block <n>', 'fork block number', FORK_BLOCK.toString())
    .option(
      '--state <file>',
      'load a state dump for a fast start (default: ./state/xlayer-fork.json if present)',
    )
    .option('--dump <file>', 'write state to this file when stopped')
    .option('--fund <address...>', 'extra addresses to fund on start', [])
    .option('-v, --verbose', 'show anvil logs')
    .action(async (o: UpOpts) => {
      const defaultState = resolve('state', 'xlayer-fork.json');
      const loadState = o.state ?? (existsSync(defaultState) ? defaultState : undefined);
      for (const a of o.fund) if (!isAddress(a)) throw new Error(`Not an address: ${a}`);

      const spin = ora(
        `Forking X Layer at block ${o.block}${loadState ? ' (from snapshot)' : ''}`,
      ).start();
      const fork = await startFork({
        port: Number(o.port),
        host: o.host,
        forkUrl: o.rpc,
        forkBlock: BigInt(o.block),
        loadState,
        dumpState: o.dump,
        verbose: o.verbose,
      }).catch((e) => {
        spin.fail('Fork failed to start');
        throw e;
      });
      spin.succeed(`Fork ready at ${pc.cyan(fork.rpcUrl)}  ${pc.dim('(chain id 196)')}`);

      const fundSpin = ora('Funding dev accounts with OKB, NAND and LATCH').start();
      const targets = [...DEV_ACCOUNTS, ...(o.fund as Address[])];
      const results = [];
      for (const a of targets) results.push(await fund(fork.rpcUrl, a));
      fundSpin.succeed('Accounts funded');
      for (const r of results) {
        console.log(
          `  ${pc.bold(r.address)}  ${formatEther(r.okb)} OKB  ${r.nand} NAND  ${r.latch} LATCH`,
        );
      }
      console.log(
        pc.dim('  Dev account keys: the standard anvil test mnemonic ("test test ... junk").'),
      );
      console.log(`\n  CPU      ${DEFAULT_CPU.name}`);
      console.log(`  circuits ${DEFAULT_CPU.circuits}`);
      console.log(`  tokens   ${DEFAULT_CPU.transistors}`);
      console.log(pc.dim(`\n  Fund any wallet: tapebox fund <address> --rpc ${fork.rpcUrl}`));
      console.log(pc.dim('  Press Ctrl+C to stop.\n'));

      const shutdown = async () => {
        const s = ora(o.dump ? `Stopping and writing ${o.dump}` : 'Stopping').start();
        await fork.stop();
        s.succeed('Stopped');
        process.exit(0);
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
      await fork.process;
    });
}
