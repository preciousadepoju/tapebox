import type { Address, Hex, WalletClient } from 'viem';
import type { Bits, Compiled } from '../tnl';

export type SandboxMode = 'fork' | 'mock';

export interface SandboxBalances {
  /** OKB with 4 decimals, for display. */
  okb: string;
  okbWei: bigint;
  nand: number;
  latch: number;
}

export interface Chip {
  circuitId: string;
  name: string;
  owner: Address;
  createdAt: number;
  blockNumber?: bigint;
  txHash?: Hex;
  inputs?: number;
  outputs?: number;
  latches?: number;
  gates?: number;
}

export type ActivityKind = 'faucet' | 'tapeOut' | 'step';

export interface Activity {
  txHash: string;
  kind: ActivityKind;
  from: Address;
  summary: string;
  blockNumber: bigint | null;
  timestamp: number;
}

export interface TapeOutArgs {
  compiled: Compiled;
  name?: string;
  account: Address;
  wallet: WalletClient | null;
}

export interface Sandbox {
  mode: SandboxMode;
  balances(address: Address): Promise<SandboxBalances>;
  tapeOut(args: TapeOutArgs): Promise<{ circuitId: string; txHash: Hex }>;
  /** Combinational read. Circuits with latches are read with step() at the given state. */
  eval(args: { circuitId: string; compiled: Compiled; inputs: Bits; state?: Bits }): Promise<Bits>;
  /** One beat: outputs at the current state and the state after it. Free (a read call). */
  step(args: { circuitId: string; compiled: Compiled; inputs: Bits; state: Bits }): Promise<{
    outputs: Bits;
    state: Bits;
  }>;
  chips(owner?: Address): Promise<Chip[]>;
  activity(limit?: number): Promise<Activity[]>;
  /** Mock only: what the faucet route would have done on a fork. */
  credit?(address: Address): void;
  log(entry: Omit<Activity, 'timestamp' | 'blockNumber'> & { blockNumber?: bigint | null }): void;
}
