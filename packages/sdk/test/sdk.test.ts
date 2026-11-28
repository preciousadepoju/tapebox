import { circuitsAbi } from '@tapebox/shared';
import { packBits, unpackBits } from '@tapebox/tap02';
import { type Hex, custom, decodeFunctionData, encodeFunctionResult } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { createTapeboxSdk } from '../src/sdk.js';

/**
 * Unit-test the real SDK's on-chain read path with a fake transport that answers eth_call by
 * running a 1-NAND circuit — no fork needed, so this runs in CI (the live path is otherwise only
 * exercised by the gated integration test).
 */
const NAND_NETLIST: Hex = '0x00000002000003';
const INFO = { inputs: 2, outputs: 1, latches: 0, gates: 1 };

function answerCall(data: Hex): Hex {
  const { functionName, args } = decodeFunctionData({ abi: circuitsAbi, data });
  switch (functionName) {
    case 'TAPEOUT_FEE':
      return encodeFunctionResult({
        abi: circuitsAbi,
        functionName,
        result: 1_300_000_000_000_000n,
      });
    case 'circuitInfo':
      return encodeFunctionResult({
        abi: circuitsAbi,
        functionName,
        result: [INFO.inputs, INFO.outputs, INFO.latches, INFO.gates],
      });
    case 'netlist':
      return encodeFunctionResult({ abi: circuitsAbi, functionName, result: NAND_NETLIST });
    case 'eval': {
      const input = args?.[1] as Hex;
      const [a, b] = unpackBits(input, INFO.inputs);
      return encodeFunctionResult({
        abi: circuitsAbi,
        functionName,
        result: packBits([!(a && b)]),
      });
    }
    default:
      throw new Error(`fake transport: unexpected ${functionName}`);
  }
}

function fakeSdk() {
  const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
    if (method === 'eth_chainId') return '0xc4';
    if (method === 'eth_call') return answerCall((params?.[0] as { data: Hex }).data);
    throw new Error(`fake transport: unexpected method ${method}`);
  });
  const sdk = createTapeboxSdk({
    rpcUrl: 'http://fake',
    transport: custom({ request }),
  });
  return { sdk, request };
}

describe('createTapeboxSdk reads (fake transport)', () => {
  it('reads circuitInfo, netlist and the tapeout fee', async () => {
    const { sdk } = fakeSdk();
    expect(await sdk.circuitInfo(1n)).toEqual(INFO);
    expect(await sdk.getNetlist(1n)).toBe(NAND_NETLIST);
    expect(await sdk.tapeoutFee()).toBe(1_300_000_000_000_000n);
  });

  it('evals the NAND truth table', async () => {
    const { sdk } = fakeSdk();
    for (const [a, b] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ] as const) {
      const { outputs } = await sdk.eval(1n, [a, b], { outputs: 1 });
      expect(outputs).toEqual([!(a && b)]);
    }
  });

  it('eval with a known output width skips the circuitInfo lookup', async () => {
    const { sdk, request } = fakeSdk();
    await sdk.eval(1n, [true, true], { outputs: 1 });
    const calls = request.mock.calls
      .filter(([a]) => a.method === 'eth_call')
      .map(
        ([a]) =>
          decodeFunctionData({ abi: circuitsAbi, data: (a.params?.[0] as { data: Hex }).data })
            .functionName,
      );
    expect(calls).toEqual(['eval']); // no circuitInfo
  });

  it('eval without a width falls back to circuitInfo', async () => {
    const { sdk, request } = fakeSdk();
    await sdk.eval(1n, [true, true]);
    const names = request.mock.calls
      .filter(([a]) => a.method === 'eth_call')
      .map(
        ([a]) =>
          decodeFunctionData({ abi: circuitsAbi, data: (a.params?.[0] as { data: Hex }).data })
            .functionName,
      );
    expect(names).toContain('circuitInfo');
    expect(names).toContain('eval');
  });
});
