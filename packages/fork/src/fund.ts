import {
  type Cpu,
  DEFAULT_CPU,
  TRANSISTOR_IDS,
  tapeboxFork,
  transistorsAbi,
} from '@tapebox/shared';
import {
  http,
  type Address,
  type Hex,
  createTestClient,
  getAddress,
  hexToBigInt,
  parseEther,
  publicActions,
  walletActions,
} from 'viem';
import { BALANCE_SLOT_CANDIDATES, erc1155BalanceSlot, toWord } from './storage.js';

export interface FundOptions {
  /** Native OKB to set (not add). Default 100 OKB. */
  okb?: bigint;
  /** NAND tokens to add. Default 1000. */
  nand?: bigint;
  /** LATCH tokens to add. Default 100. */
  latch?: bigint;
  cpu?: Cpu;
}

export interface FundResult {
  address: Address;
  okb: bigint;
  nand: bigint;
  latch: bigint;
  method: 'storage' | 'transfer';
}

export const FUND_DEFAULTS = { okb: parseEther('100'), nand: 1000n, latch: 100n } as const;

/**
 * Viem client with anvil cheat actions. Pass `adminToken` when talking to the hosted sandbox
 * through the RPC proxy (the faucet backend): it is sent as a Bearer token so cheat methods pass.
 */
export function forkClient(rpcUrl: string, opts: { adminToken?: string } = {}) {
  const fetchOptions = opts.adminToken
    ? { headers: { authorization: `Bearer ${opts.adminToken}` } }
    : undefined;
  return createTestClient({
    mode: 'anvil',
    chain: tapeboxFork(rpcUrl),
    transport: http(rpcUrl, { fetchOptions }),
  })
    .extend(publicActions)
    .extend(walletActions);
}
export type ForkClient = ReturnType<typeof forkClient>;

// Per token contract, which root slot was found to hold balances (cached after first success).
const balanceRootCache = new Map<string, Hex | bigint>();

async function balanceOf(client: ForkClient, token: Address, who: Address, id: bigint) {
  return client.readContract({
    address: token,
    abi: transistorsAbi,
    functionName: 'balanceOf',
    args: [who, id],
  });
}

/** Set an ERC-1155 balance by writing storage; verifies via balanceOf and searches layouts if needed. */
export async function setTransistorBalance(
  client: ForkClient,
  token: Address,
  who: Address,
  id: bigint,
  amount: bigint,
): Promise<boolean> {
  const cached = balanceRootCache.get(token.toLowerCase());
  const roots = cached !== undefined ? [cached] : BALANCE_SLOT_CANDIDATES;
  for (const root of roots) {
    const slot = erc1155BalanceSlot(root, id, who);
    const before = await client.getStorageAt({ address: token, slot });
    await client.setStorageAt({ address: token, index: slot, value: toWord(amount) });
    if ((await balanceOf(client, token, who, id)) === amount) {
      balanceRootCache.set(token.toLowerCase(), root);
      return true;
    }
    // wrong layout: restore what was there
    await client.setStorageAt({
      address: token,
      index: slot,
      value: toWord(before ? hexToBigInt(before) : 0n),
    });
  }
  return false;
}

/** Fallback: impersonate the CPU creator (a large holder) and transfer real tokens. */
async function transferFromHolder(
  client: ForkClient,
  token: Address,
  to: Address,
  id: bigint,
  amount: bigint,
) {
  const holder = await client.readContract({
    address: token,
    abi: transistorsAbi,
    functionName: 'creator',
  });
  await client.impersonateAccount({ address: holder });
  await client.setBalance({ address: holder, value: parseEther('10') });
  try {
    const hash = await client.writeContract({
      account: holder,
      chain: null,
      address: token,
      abi: transistorsAbi,
      functionName: 'safeTransferFrom',
      args: [holder, to, id, amount, '0x'],
    });
    await client.waitForTransactionReceipt({ hash });
  } finally {
    await client.stopImpersonatingAccount({ address: holder });
  }
}

/**
 * Give a wallet test OKB plus NAND and LATCH on the fork. Server-side only: it uses cheat methods
 * that the public RPC proxy blocks.
 */
export async function fund(
  rpcUrlOrClient: string | ForkClient,
  address: Address,
  opts: FundOptions = {},
): Promise<FundResult> {
  const client = typeof rpcUrlOrClient === 'string' ? forkClient(rpcUrlOrClient) : rpcUrlOrClient;
  const who = getAddress(address);
  const cpu = opts.cpu ?? DEFAULT_CPU;
  const okb = opts.okb ?? FUND_DEFAULTS.okb;
  const add = { nand: opts.nand ?? FUND_DEFAULTS.nand, latch: opts.latch ?? FUND_DEFAULTS.latch };

  await client.setBalance({ address: who, value: okb });

  let method: FundResult['method'] = 'storage';
  const finals = { nand: 0n, latch: 0n };
  for (const key of ['nand', 'latch'] as const) {
    const id = key === 'nand' ? TRANSISTOR_IDS.NAND : TRANSISTOR_IDS.LATCH;
    const current = await balanceOf(client, cpu.transistors, who, id);
    const target = current + add[key];
    if (add[key] > 0n) {
      const ok = await setTransistorBalance(client, cpu.transistors, who, id, target);
      if (!ok) {
        method = 'transfer';
        await transferFromHolder(client, cpu.transistors, who, id, add[key]);
      }
    }
    finals[key] = await balanceOf(client, cpu.transistors, who, id);
  }

  return { address: who, okb, nand: finals.nand, latch: finals.latch, method };
}
