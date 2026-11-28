'use client';

import { type Bits, PRESETS, parse, simulate } from '@/lib/tnl';
import { useCallback, useMemo, useState } from 'react';
import { Card, CardHead, cn } from '../sandbox/ui';
import { CircuitDiagram } from './CircuitDiagram';
import { NetlistEditor } from './NetlistEditor';
import { RunPanel } from './RunPanel';
import { TruthTable } from './TruthTable';

export function Playground() {
  const [source, setSource] = useState(PRESETS.halfAdder?.source ?? '');
  const [inputs, setInputs] = useState<Bits>({});
  const [tab, setTab] = useState<'chain' | 'table'>('chain');
  const netlist = useMemo(() => parse(source), [source]);
  const values = useMemo(() => {
    if (netlist.errors.length) return {};
    try {
      return simulate(netlist, inputs).values;
    } catch {
      return {};
    }
  }, [netlist, inputs]);
  const toggle = useCallback((name: string) => setInputs((v) => ({ ...v, [name]: !v[name] })), []);

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 p-3 lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(340px,5fr)_7fr]">
      <Card className="flex min-h-[360px] flex-col overflow-hidden">
        <CardHead
          title="Netlist"
          right={
            <select
              aria-label="Example circuits"
              className="rounded border border-line bg-panel-2 px-2 py-1 text-xs"
              defaultValue="halfAdder"
              onChange={(e) => {
                const p = PRESETS[e.target.value];
                if (p) {
                  setSource(p.source);
                  setInputs({});
                }
              }}
            >
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.title}
                </option>
              ))}
            </select>
          }
        />
        <div className="min-h-0 flex-1">
          <NetlistEditor value={source} onChange={setSource} errors={netlist.errors} />
        </div>
        <div className="border-t border-line px-4 py-2 text-xs">
          {netlist.errors.length ? (
            <ul className="space-y-0.5 text-danger">
              {netlist.errors.slice(0, 3).map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted">
              ✓ well-formed · {netlist.inputs.length} in · {netlist.outputs.length} out ·{' '}
              {netlist.gates.length} gates
            </span>
          )}
        </div>
      </Card>

      <div className="flex min-h-0 flex-col gap-3">
        <Card className="relative min-h-[320px] flex-[3] overflow-hidden">
          <div className="absolute top-2 left-3 z-10 text-xs text-muted">
            Click an input to toggle it
          </div>
          {netlist.errors.length === 0 ? (
            <CircuitDiagram netlist={netlist} values={values} onToggle={toggle} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Diagram appears once the netlist is valid.
            </div>
          )}
        </Card>
        <Card className="flex min-h-[220px] flex-[2] flex-col overflow-hidden">
          <div className="flex border-b border-line text-xs" role="tablist">
            {(
              [
                ['chain', 'Run on sandbox'],
                ['table', 'Truth table'],
              ] as const
            ).map(([k, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === k}
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  'px-4 py-2.5',
                  tab === k ? 'border-b-2 border-accent text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {tab === 'table' ? (
              <TruthTable netlist={netlist} current={inputs} />
            ) : (
              <RunPanel source={source} netlist={netlist} inputs={inputs} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
