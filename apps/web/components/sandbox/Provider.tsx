'use client';

import { createForkSandbox } from '@/lib/sandbox/fork';
import { createMockSandbox } from '@/lib/sandbox/mock';
import type { Sandbox, SandboxBalances, SandboxMode } from '@/lib/sandbox/types';
import {
  type ConnectedWallet,
  type InjectedInfo,
  checkWalletOnFork,
  connectInjected,
  discoverWallets,
  loadBurner,
  resetBurner,
} from '@/lib/wallet';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Address, EIP1193Provider } from 'viem';

export interface FaucetResult {
  okb: string;
  nand: string;
  latch: string;
}

interface SandboxContext {
  mode: SandboxMode;
  sdk: Sandbox;
  account: Address | null;
  wallet: ConnectedWallet | null;
  usingBurner: boolean;
  balances: SandboxBalances | null;
  /** Bumps whenever balances, chips or activity may have changed. */
  version: number;
  refresh: () => void;
  requestFaucet: () => Promise<FaucetResult>;
  newBurner: () => void;
  injected: InjectedInfo[];
  connect: (info: InjectedInfo) => Promise<void>;
  disconnect: () => void;
  /** Throws if an injected wallet is pointed anywhere but the fork. */
  assertSafeToSend: () => Promise<void>;
}

const Ctx = createContext<SandboxContext | null>(null);

export function useSandbox() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSandbox must be used inside <SandboxProvider>');
  return v;
}

export function SandboxProvider({ mode, children }: { mode: SandboxMode; children: ReactNode }) {
  const names = useRef(new Map<string, string>());
  const sdk = useMemo(
    () => (mode === 'mock' ? createMockSandbox() : createForkSandbox(names.current)),
    [mode],
  );
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const providerRef = useRef<EIP1193Provider | null>(null);
  const [balances, setBalances] = useState<SandboxBalances | null>(null);
  const [version, setVersion] = useState(0);
  const [injected, setInjected] = useState<InjectedInfo[]>([]);

  useEffect(() => setWallet(loadBurner(true)), []);
  useEffect(() => discoverWallets(setInjected), []);

  const account = wallet?.address ?? null;
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version is the refresh trigger
  useEffect(() => {
    if (!account) return;
    let live = true;
    const load = () =>
      sdk
        .balances(account)
        .then((b) => live && setBalances(b))
        .catch(() => live && setBalances(null));
    load();
    const t = window.setInterval(load, 4000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [account, sdk, version]);

  const requestFaucet = useCallback(async (): Promise<FaucetResult> => {
    if (!account) throw new Error('no account yet');
    const res = await fetch('/api/faucet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: account }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      mock?: boolean;
    } & Partial<FaucetResult>;
    if (!res.ok || !body.ok) throw new Error(body.error ?? `faucet failed (${res.status})`);
    if (sdk.credit) sdk.credit(account);
    else {
      sdk.log({
        txHash: `faucet-${Date.now()}`,
        kind: 'faucet',
        from: account,
        summary: '100 OKB, +1000 NAND, +100 LATCH',
      });
    }
    refresh();
    return { okb: body.okb ?? '0', nand: body.nand ?? '0', latch: body.latch ?? '0' };
  }, [account, sdk, refresh]);

  const newBurner = useCallback(() => {
    providerRef.current = null;
    setWallet(resetBurner());
    setBalances(null);
    refresh();
  }, [refresh]);

  const connect = useCallback(
    async (info: InjectedInfo) => {
      const w = await connectInjected(info);
      providerRef.current = info.provider;
      setWallet(w);
      setBalances(null);
      refresh();
    },
    [refresh],
  );

  const disconnect = useCallback(() => {
    providerRef.current = null;
    setWallet(loadBurner(true));
    setBalances(null);
    refresh();
  }, [refresh]);

  const assertSafeToSend = useCallback(async () => {
    if (mode !== 'fork' || wallet?.kind !== 'injected' || !providerRef.current) return;
    const check = await checkWalletOnFork(providerRef.current);
    if (!check.ok) throw new Error(check.reason);
  }, [mode, wallet]);

  const value: SandboxContext = {
    mode,
    sdk,
    account,
    wallet,
    usingBurner: wallet?.kind !== 'injected',
    balances,
    version,
    refresh,
    requestFaucet,
    newBurner,
    injected,
    connect,
    disconnect,
    assertSafeToSend,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
