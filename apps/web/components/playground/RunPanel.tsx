'use client';

import { reason } from '@/lib/tapeout';
import { type Bits, type Compiled, type Parsed, compile, simulate } from '@/lib/tnl';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSandbox } from '../sandbox/Provider';
import { BitBox, Button, short } from '../sandbox/ui';

interface Taped {
  id: string;
  source: string;
  txHash: string;
  compiled: Compiled;
  parsed: Parsed;
}

interface Beat {
  beat: number;
  inputs: Bits;
  outputs: Bits;
  key: string;
}

const fmt = (b: Bits) =>
  Object.entries(b)
    .map(([k, v]) => `${k}=${v ? 1 : 0}`)
    .join(' ');

export function RunPanel({
  source,
  netlist,
  inputs,
}: { source: string; netlist: Parsed; inputs: Bits }) {
  const { sdk, account, wallet, balances, requestFaucet, assertSafeToSend, refresh } = useSandbox();
  const [chip, setChip] = useState<Taped | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evalOut, setEvalOut] = useState<{ outputs: Bits; match: boolean } | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [state, setState] = useState<Bits>({});

  const compiled = useMemo(() => {
    if (netlist.errors.length) return null;
    try {
      return compile(netlist);
    } catch {
      return null;
    }
  }, [netlist]);
  const cost = compiled?.cost ?? { nand: 0, latch: 0 };
  const stale = chip && chip.source !== source;
  const short_ =
    balances &&
    (balances.nand < cost.nand || balances.latch < cost.latch || balances.okbWei === 0n);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear the read when inputs change
  useEffect(() => setEvalOut(null), [inputs]);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(reason(e));
    } finally {
      setBusy(null);
    }
  };

  const tapeOut = () =>
    run('tapeOut', async () => {
      if (!account || !compiled) throw new Error('no account yet');
      await assertSafeToSend();
      const r = await sdk.tapeOut({ compiled, account, wallet: wallet?.client ?? null });
      setChip({ id: r.circuitId, source, txHash: r.txHash, compiled, parsed: netlist });
      setBeats([]);
      setState({});
      setEvalOut(null);
      refresh();
    });

  const doEval = () =>
    run('eval', async () => {
      if (!chip) return;
      const outputs = await sdk.eval({
        circuitId: chip.id,
        compiled: chip.compiled,
        inputs,
        state,
      });
      const local = simulate(chip.parsed, inputs, state).outputs;
      setEvalOut({ outputs, match: Object.keys(local).every((k) => local[k] === outputs[k]) });
    });

  const doStep = () =>
    run('step', async () => {
      if (!chip || !account) return;
      const r = await sdk.step({ circuitId: chip.id, compiled: chip.compiled, inputs, state });
      setState(r.state);
      setBeats((prev) => {
        const beat = (prev[0]?.beat ?? 0) + 1;
        sdk.log({
          txHash: `step-${chip.id}-${beat}-${Date.now()}`,
          kind: 'step',
          from: account,
          summary: `chip #${chip.id} beat ${beat}`,
        });
        return [
          { beat, inputs: { ...inputs }, outputs: r.outputs, key: `${beat}-${Date.now()}` },
          ...prev,
        ].slice(0, 20);
      });
    });

  return (
    <div className="space-y-4 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">Cost:</span>
        <span className="font-mono">
          {cost.nand} NAND · {cost.latch} LATCH · 0.0013 OKB
        </span>
        {balances && (
          <span className="text-xs text-muted">
            (you have {balances.nand} · {balances.latch})
          </span>
        )}
        {compiled && compiled.extra > 0 && (
          <span
            className="text-xs text-muted"
            title="Enables become a 4-NAND mux; outputs that are not the last gates get a 2-NAND buffer"
          >
            includes {compiled.extra} routing NAND
          </span>
        )}
      </div>

      {short_ ? (
        <Button
          onClick={() =>
            run('faucet', async () => {
              await requestFaucet();
            })
          }
          disabled={busy !== null}
        >
          {busy === 'faucet' ? 'Funding…' : 'Get free transistors first'}
        </Button>
      ) : (
        <Button onClick={tapeOut} disabled={busy !== null || !compiled || !account}>
          {busy === 'tapeOut'
            ? 'Taping out…'
            : chip
              ? stale
                ? 'Tape out new version'
                : 'Tape out again'
              : 'Tape out on the sandbox'}
        </Button>
      )}

      {chip && (
        <div className="space-y-3 rounded-md border border-line bg-panel-2 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
            <span>chip #{chip.id}</span>
            <Link href="/app/explorer" className="text-muted hover:text-ink">
              tx {short(chip.txHash, 8, 6)} ↗
            </Link>
            {chip.compiled.latches.length > 0 && (
              <span className="text-muted">
                state {chip.compiled.latches.map((l) => `${l}=${state[l] ? 1 : 0}`).join(' ')}
              </span>
            )}
          </div>
          {stale && (
            <p className="text-xs text-muted">
              Editor changed since this tape-out. On-chain results use the taped-out version.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={doEval} disabled={busy !== null}>
              {busy === 'eval' ? '…' : 'eval()'}
            </Button>
            <Button variant="secondary" onClick={doStep} disabled={busy !== null}>
              {busy === 'step' ? '…' : 'step()'}
            </Button>
            {chip.compiled.latches.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setState({});
                  setBeats([]);
                }}
                disabled={busy !== null}
              >
                reset state
              </Button>
            )}
          </div>
          {evalOut && (
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
              <span className="text-muted">on-chain eval:</span>
              {Object.entries(evalOut.outputs).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  {k} <BitBox on={v} />
                </span>
              ))}
              <span className={evalOut.match ? 'text-accent' : 'text-danger'}>
                {evalOut.match ? '✓ matches the diagram' : '✗ differs from the diagram'}
              </span>
            </div>
          )}
          {beats.length > 0 && (
            <table className="w-full font-mono text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="text-left font-normal">beat</th>
                  <th className="text-left font-normal">in</th>
                  <th className="text-left font-normal">out</th>
                </tr>
              </thead>
              <tbody>
                {beats.map((b) => (
                  <tr key={b.key} className="border-t border-line">
                    <td className="py-1">{b.beat}</td>
                    <td className="py-1">{fmt(b.inputs)}</td>
                    <td className="py-1">{fmt(b.outputs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
