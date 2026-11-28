import { writeFile } from 'node:fs/promises';
import { createMockSdk, createTapeboxSdk } from '@tapebox/sdk';
import { DEFAULT_FORK_PORT, FORK_BLOCK, xLayer } from '@tapebox/shared';
import type { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import type { Hex } from 'viem';
import { loadConfig } from '../test/config.js';
import { toJUnit, toJson, toMarkdown, toTerminal } from '../test/report.js';
import { runSuite } from '../test/runner.js';

// anvil dev account #0 — `tapebox up` funds it on start. A publicly known test key; never a real one.
const DEV_KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

interface TestOpts {
  config?: string;
  rpc: string;
  mock?: boolean;
  account: string;
  json?: string;
  md?: string;
  junit?: string;
}

export function registerTest(program: Command) {
  program
    .command('test')
    .description('Run TAP-02 truth tables from tapebox.config against a fork (or --mock)')
    .option('-c, --config <file>', 'config file (default: tapebox.config.ts|mjs|js)')
    .option('--rpc <url>', 'fork RPC', `http://127.0.0.1:${DEFAULT_FORK_PORT}`)
    .option('--mock', 'run against the in-memory mock SDK (no fork; for CI and self-test)')
    .option('--account <key>', 'private key for tape-outs (default: anvil dev account #0)', DEV_KEY)
    .option('--json <file>', 'write a JSON report')
    .option('--md <file>', 'write a Markdown report')
    .option('--junit <file>', 'write a JUnit XML report')
    .action(async (o: TestOpts) => {
      const config = await loadConfig(o.config);
      const rpc = config.rpc ?? o.rpc;
      const sdk = o.mock
        ? createMockSdk()
        : createTapeboxSdk({ rpcUrl: rpc, account: o.account as Hex });

      const spin = ora(
        o.mock ? 'Running tests (mock SDK)' : `Running tests against ${rpc}`,
      ).start();
      const report = await runSuite(sdk, config, {
        version: '0.1.0',
        mode: o.mock ? 'mock' : 'fork',
        chainId: xLayer.id,
        forkBlock: o.mock ? undefined : Number(FORK_BLOCK),
      }).catch((e) => {
        spin.fail('Test run failed to start');
        throw e;
      });
      const { passed, failed, skipped } = report.summary;
      const total = passed + failed + skipped;
      if (failed === 0) spin.succeed('Tests complete');
      else spin.fail(`${failed} of ${total} failed`);

      console.log(`\n${toTerminal(report)}\n`);

      const writes: Promise<void>[] = [];
      if (o.json) writes.push(writeFile(o.json, toJson(report)));
      if (o.md) writes.push(writeFile(o.md, toMarkdown(report)));
      if (o.junit) writes.push(writeFile(o.junit, toJUnit(report)));
      if (writes.length) {
        await Promise.all(writes);
        console.log(pc.dim(`  wrote ${[o.json, o.md, o.junit].filter(Boolean).join(', ')}`));
      }

      if (failed > 0) process.exitCode = 1;
    });
}
