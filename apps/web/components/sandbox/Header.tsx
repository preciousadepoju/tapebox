'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSandbox } from './Provider';
import { Tag, cn, short } from './ui';

export const NAV = [
  { href: '/app/playground', label: 'Playground', blurb: 'Write a circuit, watch it light up' },
  { href: '/app/faucet', label: 'Faucet', blurb: 'Free NAND, LATCH and OKB' },
  { href: '/app/explorer', label: 'Explorer', blurb: 'Everything on the sandbox' },
  { href: '/app/reports', label: 'Reports', blurb: 'tapebox test results' },
  { href: '/app/docs', label: 'Quick-start', blurb: 'First chip in 5 minutes' },
] as const;

function Burger({ open }: { open: boolean }) {
  return (
    <span className="relative block h-3 w-5" aria-hidden="true">
      <span
        className={cn(
          'absolute left-0 h-px w-5 bg-current transition',
          open ? 'top-1.5 rotate-45' : 'top-0',
        )}
      />
      <span
        className={cn(
          'absolute left-0 top-1.5 h-px w-5 bg-current transition',
          open && 'opacity-0',
        )}
      />
      <span
        className={cn(
          'absolute left-0 h-px w-5 bg-current transition',
          open ? 'top-1.5 -rotate-45' : 'top-3',
        )}
      />
    </span>
  );
}

export function Header() {
  const path = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const { mode, account, usingBurner, balances, wallet, injected, connect, disconnect } =
    useSandbox();
  const [connectError, setConnectError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the menu on navigation
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const first = injected[0];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-ink/10"
          >
            <Burger open={open} />
          </button>
          <a
            href="/"
            className="flex items-center gap-2 font-display text-xl uppercase tracking-wide"
          >
            <span className="inline-block h-3 w-3 rounded-sm bg-accent" />
            Tapebox
          </a>
          <nav className="hidden gap-1 text-sm lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'whitespace-nowrap rounded px-2.5 py-1.5 text-muted hover:text-ink',
                  path.startsWith(n.href) && 'bg-panel-2 text-ink',
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            {mode === 'mock' ? (
              <Tag
                className="hidden sm:inline-flex"
                title="TAPEBOX_RPC is not set: running on the in-browser mock"
              >
                mock
              </Tag>
            ) : (
              <Tag
                className="hidden border-lime-900 text-accent sm:inline-flex"
                title="Live on the Tapebox fork"
              >
                fork · 196
              </Tag>
            )}
            {balances && (
              <span className="hidden font-mono text-muted xl:inline">
                {balances.nand} NAND · {balances.latch} LATCH · {balances.okb} OKB
              </span>
            )}
            {account && (
              <Tag title={account}>
                {usingBurner ? 'burner ' : `${wallet?.label ?? 'wallet'} `}
                {short(account)}
              </Tag>
            )}
          </div>
        </div>
      </header>

      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={cn(
          'fixed inset-0 z-30 flex flex-col bg-[#060908]/97 pt-14 backdrop-blur transition duration-300',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        <div
          aria-hidden="true"
          className="tb-grain pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        />
        <nav className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6">
          {NAV.map((n, i) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path.startsWith(n.href) ? 'page' : undefined}
              className="group flex items-baseline justify-between gap-6 border-b border-line py-3 md:py-4"
              style={{ transitionDelay: open ? `${i * 40}ms` : '0ms' }}
            >
              <span className="tb-outline-hover font-display text-[clamp(40px,min(9vw,12vh),128px)] uppercase leading-[0.95]">
                {n.label}
              </span>
              <span className="hidden text-sm text-muted group-hover:text-ink md:block">
                {n.blurb}
              </span>
            </Link>
          ))}
        </nav>
        <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted">
          <span className="font-mono">
            {account ? `${usingBurner ? 'burner ' : ''}${short(account)}` : ''}
            {balances
              ? ` · ${balances.nand} NAND · ${balances.latch} LATCH · ${balances.okb} OKB`
              : ''}
          </span>
          {connectError && <span className="text-danger">{connectError}</span>}
          {!usingBurner ? (
            <button type="button" className="hover:text-ink" onClick={disconnect}>
              Disconnect wallet
            </button>
          ) : (
            first && (
              <button
                type="button"
                className="hover:text-ink"
                onClick={() => {
                  setConnectError(null);
                  connect(first).catch((e: unknown) =>
                    setConnectError(
                      e instanceof Error
                        ? (e.message.split('\n')[0] ?? 'Could not connect')
                        : 'Could not connect',
                    ),
                  );
                }}
              >
                Use MetaMask / OKX Wallet instead
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}
