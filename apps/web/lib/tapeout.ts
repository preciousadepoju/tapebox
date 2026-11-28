import {
  DEFAULT_CPU,
  TAPEOUT_FEE_WEI,
  TRANSISTOR_IDS,
  circuitsAbi,
  transistorsAbi,
} from '@tapebox/shared';
import { type Address, type Hex, type WalletClient, parseEventLogs, zeroAddress } from 'viem';
import { publicClient } from './chain';
import type { Circuit } from './netlist';
import { encodeNetlist } from './netlist';

export const cpu = DEFAULT_CPU;

export interface Balances {
  okb: bigint;
  nand: bigint;
  latch: bigint;
}

export async function readBalances(address: Address): Promise<Balances> {
  const [okb, tokens] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: cpu.transistors,
      abi: transistorsAbi,
      functionName: 'balanceOfBatch',
      args: [
        [address, address],
        [TRANSISTOR_IDS.NAND, TRANSISTOR_IDS.LATCH],
      ],
    }),
  ]);
  return { okb, nand: tokens[0] ?? 0n, latch: tokens[1] ?? 0n };
}

export async function readTapeoutFee(): Promise<bigint> {
  try {
    return await publicClient.readContract({
      address: cpu.circuits,
      abi: circuitsAbi,
      functionName: 'TAPEOUT_FEE',
    });
  } catch {
    return TAPEOUT_FEE_WEI;
  }
}

export interface TapeoutResult {
  id: bigint;
  hash: Hex;
}

/** Simulate first (clear revert reasons, no fee lost), then send through the wallet. */
export async function tapeout(
  wallet: WalletClient,
  account: Address,
  circuit: Circuit,
  fee: bigint,
): Promise<TapeoutResult> {
  const netlist = encodeNetlist(circuit.gates);
  const { request, result } = await publicClient.simulateContract({
    account,
    address: cpu.circuits,
    abi: circuitsAbi,
    functionName: 'tapeout',
    args: [netlist, circuit.inputs, circuit.outputs],
    value: fee,
  });
  const hash = await wallet.writeContract({ ...request, account: wallet.account ?? account });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Tapeout reverted on-chain');
  const minted = parseEventLogs({
    abi: circuitsAbi,
    eventName: 'Transfer',
    logs: receipt.logs,
  }).find(
    (l) => l.address.toLowerCase() === cpu.circuits.toLowerCase() && l.args.from === zeroAddress,
  );
  return { id: minted?.args.tokenId ?? result, hash };
}

/** Pull a readable reason out of a viem error. */
export function reason(e: unknown): string {
  if (!(e instanceof Error)) return 'Something went wrong';
  const any = e as Error & { shortMessage?: string; details?: string };
  const msg = any.shortMessage || any.message;
  const m = /reverted with the following reason:\s*\n?(.+)/.exec(any.message);
  if (m?.[1]) return m[1].trim();
  if (/User rejected|denied/i.test(any.message)) return 'Request rejected in your wallet';
  if (/insufficient funds/i.test(any.message))
    return 'Not enough OKB for the fee. Use the faucet first.';
  return msg.split('\n')[0] ?? msg;
}
