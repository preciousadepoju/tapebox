'use client';

import { publicClient } from '@/lib/chain';
import type { Activity, Chip } from '@/lib/sandbox/types';
import { useEffect, useState } from 'react';
import type { Block } from 'viem';
import { useSandbox } from './Provider';
import { Card, CardHead, Tag, cn, short, timeAgo } from './ui';

const KIND_STYLE: Record<Activity['kind'], string> = {
  faucet: 'text-sky-300 border-sky-900',
  tapeOut: 'text-accent border-lime-900',
  step: 'text-muted',
};

function usePoll<T>(
  fn: () => Promise<T>,
  ms: number,
  deps: unknown[],
): { data: T | undefined; error: string | null } {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are passed by the caller
  useEffect(() => {
    let live = true;
    const load = () =>
      fn()
        .then((d) => {
          if (live) {
            setData(d);
            setError(null);
          }
        })
        .catch(
          (e: unknown) =>
            live && setError(e instanceof Error ? (e.message.split('\n')[0] ?? 'error') : 'error'),
        );
    load();
    const t = window.setInterval(load, ms);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, deps);
  return { data, error };
}

function ForkBlocks() {
  const { data, error } = usePoll(
    async () => {
      const head = await publicClient.getBlockNumber();
      const nums = Array.from({ length: 10 }, (_, i) => head - BigInt(i)).filter((n) => n >= 0n);
      return Promise.all(nums.map((n) => publicClient.getBlock({ blockNumber: n })));
    },
    3000,
    [],
  );
  if (error) return <p className="p-4 text-danger text-sm">RPC error: {error}</p>;
  return (
    <table className="w-full font-mono text-xs">
      <tbody>
        {(data ?? []).map((b: Block) => (
          <tr key={String(b.number)} className="border-line border-t">
            <td className="px-4 py-2">#{String(b.number)}</td>
            <td className="px-4 py-2 text-muted">{short(b.hash ?? '', 10, 6)}</td>
            <td className="px-4 py-2">{b.transactions.length} tx</td>
            <td className="px-4 py-2 text-right text-muted">
              {timeAgo(Number(b.timestamp) * 1000)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ExplorerPage() {
  const { sdk, account, mode, version } = useSandbox();
  const [mine, setMine] = useState(false);
  const { data: activity = [] } = usePoll<Activity[]>(() => sdk.activity(100), 2500, [
    sdk,
    version,
  ]);
  const { data: chips = [], error } = usePoll<Chip[]>(
    () => sdk.chips(mine && account ? account : undefined),
    4000,
    [sdk, mine, account, version],
  );
  const rows =
    mine && account
      ? activity.filter((a) => a.from.toLowerCase() === account.toLowerCase())
      : activity;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-semibold text-2xl">Explorer</h1>
          <p className="mt-1 text-muted text-sm">
            Everything happening on the sandbox fork: faucet drips, tape-outs and beats.
          </p>
        </div>
        <label className="flex items-center gap-2 text-muted text-sm">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Only my account
        </label>
      </div>
      {error && <p className="text-danger text-sm">RPC error: {error}</p>}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHead title="Activity" right={<Tag>{rows.length}</Tag>} />
          {rows.length === 0 ? (
            <p className="p-4 text-muted text-sm">
              Nothing yet. Hit the faucet, then tape out a chip in the playground.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="px-4 py-2 font-normal">block</th>
                    <th className="px-4 py-2 font-normal">type</th>
                    <th className="px-4 py-2 font-normal">tx</th>
                    <th className="px-4 py-2 font-normal">from</th>
                    <th className="px-4 py-2 font-normal">details</th>
                    <th className="px-4 py-2 text-right font-normal">when</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {rows.map((a) => (
                    <tr key={a.txHash} className="border-line border-t">
                      <td className="px-4 py-2">
                        {a.blockNumber === null ? '·' : `#${String(a.blockNumber)}`}
                      </td>
                      <td className="px-4 py-2">
                        <Tag className={cn(KIND_STYLE[a.kind])}>{a.kind}</Tag>
                      </td>
                      <td className="px-4 py-2 text-muted" title={a.txHash}>
                        {a.txHash.startsWith('0x') ? short(a.txHash, 8, 4) : 'read call'}
                      </td>
                      <td className="px-4 py-2 text-muted" title={a.from}>
                        {short(a.from)}
                      </td>
                      <td className="px-4 py-2 font-sans">{a.summary}</td>
                      <td className="px-4 py-2 text-right text-muted">{timeAgo(a.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHead title="Chips" right={<Tag>{chips.length}</Tag>} />
            {chips.length === 0 ? (
              <p className="p-4 text-muted text-sm">No chips taped out yet.</p>
            ) : (
              <ul className="max-h-[480px] divide-y divide-line overflow-auto">
                {chips.map((c) => (
                  <li key={c.circuitId} className="px-4 py-2.5">
                    <div className="flex justify-between text-sm">
                      <span>{c.name}</span>
                      <span className="font-mono text-muted text-xs">
                        {c.blockNumber !== undefined ? `block ${String(c.blockNumber)}` : ''}
                      </span>
                    </div>
                    <div className="font-mono text-muted text-xs">
                      id {c.circuitId} · by {short(c.owner)}
                    </div>
                    {c.gates !== undefined && (
                      <div className="font-mono text-muted text-xs">
                        {c.inputs}→{c.outputs} · {c.gates} gates
                        {c.latches ? ` · ${c.latches} latch` : ''}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {mode === 'fork' && (
            <Card>
              <CardHead title="Latest fork blocks" />
              <ForkBlocks />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
