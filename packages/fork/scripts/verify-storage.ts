/**
 * Read-only check against X Layer mainnet: confirms which storage slot holds Transistors balances,
 * by finding a real NAND holder and comparing eth_getStorageAt with balanceOf.
 *   pnpm --filter @tapebox/fork exec tsx scripts/verify-storage.ts
 */
import { DEFAULT_CPU, circuitsAbi, transistorsAbi, xLayer } from '@tapebox/shared';
import { http, type Address, createPublicClient, hexToBigInt } from 'viem';
import { BALANCE_SLOT_CANDIDATES, erc1155BalanceSlot } from '../src/storage.js';

const client = createPublicClient({ chain: xLayer, transport: http() });
const token = (process.argv[2] as Address | undefined) ?? DEFAULT_CPU.transistors;

// Builders who taped out circuits on this CPU are likely to still hold transistors.
const circuits = await client.readContract({
  address: token,
  abi: transistorsAbi,
  functionName: 'circuits',
});
const nextId = await client.readContract({
  address: circuits,
  abi: circuitsAbi,
  functionName: 'nextId',
});
let holder: Address | undefined;
let id = 0n;
search: for (let i = 1n; i < nextId; i++) {
  const owner = await client.readContract({
    address: circuits,
    abi: circuitsAbi,
    functionName: 'ownerOf',
    args: [i],
  });
  for (const tid of [0n, 1n]) {
    const bal = await client.readContract({
      address: token,
      abi: transistorsAbi,
      functionName: 'balanceOf',
      args: [owner, tid],
    });
    if (bal > 0n) {
      holder = owner;
      id = tid;
      break search;
    }
  }
}
if (!holder) throw new Error('no holder found among circuit owners');

const balance = await client.readContract({
  address: token,
  abi: transistorsAbi,
  functionName: 'balanceOf',
  args: [holder, id],
});
console.log(`holder ${holder} id ${id} balanceOf ${balance}`);
for (const base of BALANCE_SLOT_CANDIDATES) {
  const slot = erc1155BalanceSlot(base, id, holder);
  const raw = await client.getStorageAt({ address: token, slot });
  const v = raw ? hexToBigInt(raw) : 0n;
  console.log(`${String(base).padEnd(68)} -> ${v}${v === balance ? '   <== MATCH' : ''}`);
}
