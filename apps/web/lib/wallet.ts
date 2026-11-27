'use client';

import {
  http,
  type Address,
  type EIP1193Provider,
  type WalletClient,
  createWalletClient,
  custom,
  toHex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { PUBLIC_RPC, forkChain, publicClient } from './chain';

const BURNER_KEY = 'tapebox.burner.v1';

export type WalletKind = 'burner' | 'injected';

export interface ConnectedWallet {
  kind: WalletKind;
  address: Address;
  client: WalletClient;
  label: string;
}

/** A throwaway key kept in this browser. Only ever holds fork tokens, which are worthless. */
export function loadBurner(create = true): ConnectedWallet | null {
  if (typeof window === 'undefined') return null;
  let pk = window.localStorage.getItem(BURNER_KEY) as `0x${string}` | null;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    if (!create) return null;
    pk = generatePrivateKey();
    window.localStorage.setItem(BURNER_KEY, pk);
  }
  const account = privateKeyToAccount(pk);
  const client = createWalletClient({ account, chain: forkChain, transport: http(PUBLIC_RPC) });
  return { kind: 'burner', address: account.address, client, label: 'Burner' };
}

export function resetBurner(): ConnectedWallet | null {
  window.localStorage.removeItem(BURNER_KEY);
  return loadBurner(true);
}

export function exportBurnerKey(): string | null {
  return window.localStorage.getItem(BURNER_KEY);
}

export interface InjectedInfo {
  id: string;
  name: string;
  icon?: string;
  provider: EIP1193Provider;
}

/** EIP-6963 discovery, falling back to window.ethereum. */
export function discoverWallets(onChange: (list: InjectedInfo[]) => void): () => void {
  const found = new Map<string, InjectedInfo>();
  const emit = () => onChange([...found.values()]);
  const onAnnounce = (ev: Event) => {
    const d = (ev as CustomEvent).detail as
      | { info: { uuid: string; name: string; icon?: string }; provider: EIP1193Provider }
      | undefined;
    if (!d?.provider) return;
    found.set(d.info.uuid, {
      id: d.info.uuid,
      name: d.info.name,
      icon: d.info.icon,
      provider: d.provider,
    });
    emit();
  };
  window.addEventListener('eip6963:announceProvider', onAnnounce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const t = window.setTimeout(() => {
    const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
    if (found.size === 0 && eth) {
      found.set('window.ethereum', {
        id: 'window.ethereum',
        name: 'Browser wallet',
        provider: eth,
      });
      emit();
    }
  }, 300);
  return () => {
    window.removeEventListener('eip6963:announceProvider', onAnnounce);
    window.clearTimeout(t);
  };
}

export async function connectInjected(info: InjectedInfo): Promise<ConnectedWallet> {
  const provider = info.provider;
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as Address[];
  const address = accounts[0];
  if (!address) throw new Error('No account was shared by the wallet');
  const chainHex = toHex(forkChain.id);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainHex }],
    });
  } catch {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainHex,
          chainName: forkChain.name,
          nativeCurrency: forkChain.nativeCurrency,
          rpcUrls: [PUBLIC_RPC],
        },
      ],
    });
  }
  const client = createWalletClient({
    account: address,
    chain: forkChain,
    transport: custom(provider),
  });
  return { kind: 'injected', address, client, label: info.name };
}

export type ForkCheck = { ok: true } | { ok: false; reason: string };

/**
 * The fork shares chain id 196 with real X Layer, so a wallet can look "connected" while it is
 * really pointed at mainnet. Before any transaction, check that the wallet's RPC serves the same
 * blocks as the fork. This stops real OKB from being spent by accident.
 */
export async function checkWalletOnFork(provider: EIP1193Provider): Promise<ForkCheck> {
  try {
    const [walletHead, forkHead] = await Promise.all([
      provider.request({ method: 'eth_blockNumber' }) as Promise<string>,
      publicClient.getBlockNumber(),
    ]);
    const n = BigInt(walletHead);
    if (n > forkHead + 5n || n + 5n < forkHead) {
      return {
        ok: false,
        reason: `Your wallet is on block ${n}, the fork is on ${forkHead}. It is probably pointed at real X Layer. Set its X Layer RPC to ${PUBLIC_RPC} or use the burner.`,
      };
    }
    const at = n < forkHead ? n : forkHead;
    const [w, f] = await Promise.all([
      provider.request({ method: 'eth_getBlockByNumber', params: [toHex(at), false] }) as Promise<{
        hash?: string;
      } | null>,
      publicClient.getBlock({ blockNumber: at }),
    ]);
    if (!w?.hash || w.hash.toLowerCase() !== f.hash?.toLowerCase()) {
      return {
        ok: false,
        reason: 'Your wallet RPC serves different blocks than the Tapebox fork.',
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Could not confirm your wallet is on the Tapebox fork.' };
  }
}
