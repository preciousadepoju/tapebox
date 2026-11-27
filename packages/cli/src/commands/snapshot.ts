import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dumpStateToFile, forkClient } from '@tapebox/fork';
import { DEFAULT_FORK_PORT } from '@tapebox/shared';
import type { Command } from 'commander';
import ora from 'ora';

export function registerSnapshot(program: Command) {
  program
    .command('snapshot [file]')
    .description('Save the running fork\'s state so the next "tapebox up" starts in seconds')
    .option('--rpc <url>', 'fork RPC', `http://127.0.0.1:${DEFAULT_FORK_PORT}`)
    .action(async (file: string | undefined, o: { rpc: string }) => {
      const out = resolve(file ?? 'state/xlayer-fork.json');
      await mkdir(dirname(out), { recursive: true });
      const spin = ora(`Dumping state to ${out}`).start();
      const bytes = await dumpStateToFile(forkClient(o.rpc), out);
      spin.succeed(`Saved ${out} (${(bytes / 1024).toFixed(0)} KiB)`);
    });
}
