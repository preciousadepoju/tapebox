import { http, type Hex, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { PUBLIC_RPC, forkChain } from '../lib/chain';
import { simulate } from '../lib/netlist';
import { createForkSandbox } from '../lib/sandbox/fork';
import { type Bits, PRESETS, compile, parse } from '../lib/tnl';

/**
 * Live-fork integration test for the fork sandbox's chain path (balances/tapeOut/eval/step).
 * Skipped unless NEXT_PUBLIC_TAPEBOX_RPC points at a running fork, so CI stays green:
 *
 *   # terminal 1
 *   pnpm tapebox up --state <abs path>/state/xlayer-fork.json
 *   # terminal 2
 *   NEXT_PUBLIC_TAPEBOX_RPC=http://127.0.0.1:8545 pnpm --filter web test
 *
 * It asserts the live chain agrees with the local simulator (lib/netlist, itself checked against
 * @tapebox/tap02), so any drift between the fork and our logic fails the test.
 */
const run = process.env.NEXT_PUBLIC_TAPEBOX_RPC ? describe : describe.skip;

// anvil dev account #0 — funded by `tapebox up`. A publicly known test key.
const KEY: Hex = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

run('fork sandbox against a live fork', () => {
  const account = privateKeyToAccount(KEY);
  const wallet = createWalletClient({ account, chain: forkChain, transport: http(PUBLIC_RPC) });
  const sandbox = createForkSandbox(new Map());

  const nameBits = (list: string[], bits: boolean[]): Bits =>
    Object.fromEntries(list.map((n, i) => [n, Boolean(bits[i])]));
  const orderBits = (list: string[], v: Bits): boolean[] => list.map((n) => Boolean(v[n]));

  it('funds, tapes out, and evals a combinational circuit (chain == local sim)', async () => {
    const compiled = compile(parse(PRESETS.xor.source));
    const bal = await sandbox.balances(account.address);
    expect(bal.nand, 'run `tapebox up` so the dev account is funded').toBeGreaterThan(0);

    const { circuitId, txHash } = await sandbox.tapeOut({
      compiled,
      account: account.address,
      wallet,
    });
    expect(txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

    for (let row = 0; row < 1 << compiled.inputs.length; row++) {
      const inBits = compiled.inputs.map((_, i) => ((row >> i) & 1) === 1);
      const chain = await sandbox.eval({
        circuitId,
        compiled,
        inputs: nameBits(compiled.inputs, inBits),
      });
      const local = simulate(compiled.circuit, inBits);
      expect(orderBits(compiled.outputs, chain), `inputs ${inBits.map(Number).join('')}`).toEqual(
        local.outputs,
      );
    }
  }, 60_000);

  it('steps a stateful circuit (chain == local sim)', async () => {
    const compiled = compile(parse(PRESETS.toggle.source));
    const { circuitId } = await sandbox.tapeOut({ compiled, account: account.address, wallet });

    let state = nameBits(
      compiled.latches,
      compiled.latches.map(() => false),
    );
    for (const t of [true, true, false, true, false]) {
      const inputs = nameBits(compiled.inputs, [t]);
      const chain = await sandbox.step({ circuitId, compiled, inputs, state });
      const local = simulate(
        compiled.circuit,
        orderBits(compiled.inputs, inputs),
        orderBits(compiled.latches, state),
      );
      expect(orderBits(compiled.outputs, chain.outputs), `t=${Number(t)}`).toEqual(local.outputs);
      expect(orderBits(compiled.latches, chain.state), `t=${Number(t)}`).toEqual(local.nextState);
      state = chain.state;
    }
  }, 60_000);
});
