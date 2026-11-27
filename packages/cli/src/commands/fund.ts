import { fund } from '@tapebox/fork';
import { DEFAULT_FORK_PORT } from '@tapebox/shared';
import type { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import { type Address, formatEther, isAddress, parseEther } from 'viem';

export function registerFund(program: Command) {
  program
    .command('fund <address>')
    .description('Give a wallet test OKB, NAND and LATCH on a running fork')
    .option(
      '--rpc <url>',
      'fork RPC (must allow anvil_* methods)',
      `http://127.0.0.1:${DEFAULT_FORK_PORT}`,
    )
    .option('--okb <amount>', 'OKB balance to set', '100')
    .option('--nand <n>', 'NAND to add', '1000')
    .option('--latch <n>', 'LATCH to add', '100')
    .action(
      async (address: string, o: { rpc: string; okb: string; nand: string; latch: string }) => {
        if (!isAddress(address)) throw new Error(`Not an address: ${address}`);
        const spin = ora(`Funding ${address}`).start();
        const r = await fund(o.rpc, address as Address, {
          okb: parseEther(o.okb),
          nand: BigInt(o.nand),
          latch: BigInt(o.latch),
        }).catch((e) => {
          spin.fail('Funding failed');
          throw e;
        });
        spin.succeed(
          `${pc.bold(r.address)}  ${formatEther(r.okb)} OKB  ${r.nand} NAND  ${r.latch} LATCH`,
        );
      },
    );
}
