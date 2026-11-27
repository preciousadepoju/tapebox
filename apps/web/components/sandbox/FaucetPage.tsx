'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSandbox } from './Provider';
import { Button, Card, CardHead } from './ui';

interface FaucetInfo {
  addressLimit: number;
  addressWindowSeconds: number;
  ipLimit: number;
  ipWindowSeconds: number;
}

function every(seconds: number) {
  if (seconds % 3600 === 0) return `${seconds / 3600} hour${seconds === 3600 ? '' : 's'}`;
  if (seconds % 60 === 0) return `${seconds / 60} minutes`;
  return `${seconds} seconds`;
}

export function FaucetPage() {
  const { mode, account, usingBurner, balances, requestFaucet, newBurner } = useSandbox();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [info, setInfo] = useState<FaucetInfo | null>(null);

  useEffect(() => {
    fetch('/api/faucet')
      .then((r) => r.json())
      .then((j: FaucetInfo) => setInfo(j))
      .catch(() => setInfo(null));
  }, []);

  const drip = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await requestFaucet();
      setMsg({
        ok: true,
        text:
          mode === 'mock'
            ? 'Sent (mock). 100 OKB, 1000 NAND and 100 LATCH.'
            : `Sent. You now hold ${r.nand} NAND and ${r.latch} LATCH.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'faucet failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-semibold text-2xl">Faucet</h1>
      <p className="mt-2 text-muted">
        Free test transistors on the sandbox fork. Each drip gives 1000 NAND, 100 LATCH and sets
        your balance to 100 OKB for fees. These only exist on the fork and are worth nothing on
        mainnet.
      </p>
      <Card className="mt-8">
        <CardHead
          title="Your sandbox account"
          right={usingBurner && <span className="text-muted text-xs">burner</span>}
        />
        <div className="space-y-5 p-4">
          <div className="break-all font-mono text-sm">{account ?? 'generating…'}</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {(
              [
                ['NAND', balances?.nand],
                ['LATCH', balances?.latch],
                ['OKB', balances?.okb],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="rounded-md border border-line bg-panel-2 p-3">
                <div className="font-mono text-xl">{v ?? '-'}</div>
                <div className="text-muted text-xs">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={drip} disabled={!account || busy}>
              {busy ? 'Sending…' : 'Get test transistors'}
            </Button>
            {balances && balances.nand > 0 && (
              <Link href="/app/playground" className="text-accent text-sm hover:underline">
                Build a chip →
              </Link>
            )}
            {usingBurner && (
              <Button variant="ghost" className="ml-auto" onClick={newBurner}>
                New burner
              </Button>
            )}
          </div>
          {msg && (
            <p className={msg.ok ? 'text-accent text-sm' : 'text-danger text-sm'}>{msg.text}</p>
          )}
        </div>
      </Card>
      <p className="mt-4 text-muted text-xs">
        {info
          ? `Limit: ${info.addressLimit} drip${info.addressLimit === 1 ? '' : 's'} per address every ${every(info.addressWindowSeconds)} and ${info.ipLimit} per IP every ${every(info.ipWindowSeconds)}. `
          : ''}
        The burner key is stored in this browser only.
      </p>
    </div>
  );
}
