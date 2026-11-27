'use client';

import { type Bits, type Report, validateReport } from '@/lib/report';
import { useCallback, useEffect, useState } from 'react';
import { BitBox, Button, Card, CardHead, Tag, cn, short } from './ui';

const STATUS: Record<string, string> = {
  passed: 'text-accent border-lime-900',
  failed: 'text-danger border-red-900',
  skipped: 'text-muted',
};

function BitList({ bits }: { bits: Bits }) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      {Object.entries(bits).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1">
          {k} <BitBox on={v} />
        </span>
      ))}
    </span>
  );
}

export function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState('');

  const accept = useCallback((json: unknown, from: string) => {
    const r = validateReport(json);
    if (r.ok) {
      setReport(r.report);
      setError(null);
      setSource(from);
    } else setError(`Not a valid tapebox report: ${r.error}`);
  }, []);

  const load = useCallback(
    async (url: string) => {
      try {
        const res = await fetch(url);
        accept(await res.json(), url);
      } catch (e) {
        setError(`Could not load ${url}: ${e instanceof Error ? e.message : 'error'}`);
      }
    },
    [accept],
  );

  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get('url');
    void load(url ?? '/sample-report.json');
  }, [load]);

  const openFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      accept(JSON.parse(await f.text()), f.name);
    } catch {
      setError(`${f.name} is not JSON`);
    }
  };

  return (
    <div
      className="mx-auto max-w-6xl space-y-4 px-4 py-8"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void openFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">Test reports</h1>
          <p className="mt-1 text-muted text-sm">
            Output of <code className="font-mono">tapebox test --reporter json</code>. Drop a report
            file here, or open <code className="font-mono">/app/reports?url=…</code> from CI.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer rounded-md border border-line bg-panel-2 px-3.5 py-2 text-sm hover:border-muted">
            Open report…
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void openFile(e.target.files?.[0])}
            />
          </label>
          <Button variant="ghost" onClick={() => void load('/sample-report.json')}>
            Sample
          </Button>
        </div>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      {report && (
        <>
          <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-4 text-sm">
            <div>
              <span
                className={cn(
                  'font-semibold text-2xl',
                  report.summary.failed ? 'text-danger' : 'text-accent',
                )}
              >
                {report.summary.failed ? `${report.summary.failed} failed` : 'All passed'}
              </span>
            </div>
            <div className="font-mono text-muted text-xs">
              {report.summary.passed} passed · {report.summary.failed} failed ·{' '}
              {report.summary.skipped} skipped · {(report.durationMs / 1000).toFixed(1)}s
            </div>
            <div className="font-mono text-muted text-xs">
              {report.chain.mode} · chain {report.chain.chainId}
              {report.chain.forkBlock !== undefined && ` · block ${report.chain.forkBlock}`}
            </div>
            <div className="ml-auto text-muted text-xs">
              {source} · tapebox {report.version} · {new Date(report.startedAt).toLocaleString()}
            </div>
          </Card>
          {report.suites.map((s) => {
            const failed = s.cases.filter((c) => c.status === 'failed').length;
            return (
              <Card key={s.name}>
                <CardHead
                  title={
                    <span className="normal-case tracking-normal">
                      <span className="text-ink">{s.name}</span>{' '}
                      <span className="font-mono">{s.circuit}</span>
                    </span>
                  }
                  right={
                    <span className="flex items-center gap-2">
                      {s.circuitId && (
                        <Tag title={s.circuitId}>chip {short(s.circuitId, 8, 4)}</Tag>
                      )}
                      <Tag>
                        {s.gates.nand} NAND · {s.gates.latch} LATCH
                      </Tag>
                      <Tag className={failed ? STATUS.failed : STATUS.passed}>
                        {s.cases.length - failed}/{s.cases.length}
                      </Tag>
                    </span>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted">
                      <tr>
                        <th className="px-4 py-2 font-normal">case</th>
                        <th className="px-4 py-2 font-normal">inputs</th>
                        <th className="px-4 py-2 font-normal">expected</th>
                        <th className="px-4 py-2 font-normal">actual</th>
                        <th className="px-4 py-2 font-normal">status</th>
                        <th className="px-4 py-2 text-right font-normal">ms</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {s.cases.map((c) => (
                        <tr
                          key={c.name}
                          className={cn(
                            'border-line border-t align-top',
                            c.status === 'failed' && 'bg-red-950/20',
                          )}
                        >
                          <td className="px-4 py-2 font-sans">
                            {c.name}
                            {c.message && (
                              <div className="mt-0.5 font-mono text-danger">{c.message}</div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <BitList bits={c.inputs} />
                          </td>
                          <td className="px-4 py-2">
                            <BitList bits={c.expected} />
                          </td>
                          <td className="px-4 py-2">
                            {c.actual ? <BitList bits={c.actual} /> : '-'}
                          </td>
                          <td className="px-4 py-2">
                            <Tag className={STATUS[c.status]}>{c.status}</Tag>
                          </td>
                          <td className="px-4 py-2 text-right text-muted">{c.durationMs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
