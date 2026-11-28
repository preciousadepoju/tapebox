'use client';

import { type Bits, type Parsed, truthTable } from '@/lib/tnl';
import { useMemo } from 'react';
import { BitBox, cn } from '../sandbox/ui';

export function TruthTable({ netlist, current }: { netlist: Parsed; current: Bits }) {
  const rows = useMemo(() => (netlist.errors.length ? [] : truthTable(netlist)), [netlist]);
  const hasLatch = netlist.gates.some((g) => g.kind === 'latch');
  if (netlist.errors.length) {
    return <p className="p-4 text-sm text-muted">Fix the errors to see the truth table.</p>;
  }
  if (!rows.length)
    return <p className="p-4 text-sm text-muted">Too many inputs for a full table (max 6).</p>;
  return (
    <div className="overflow-auto">
      {hasLatch && (
        <p className="px-4 pt-3 text-xs text-muted">
          Latches shown at their reset value (0). Use step() to run beats.
        </p>
      )}
      <table className="w-full text-center font-mono text-xs">
        <thead className="text-muted">
          <tr>
            {netlist.inputs.map((n) => (
              <th key={n} className="px-2 py-2 font-normal">
                {n}
              </th>
            ))}
            <th className="w-4" />
            {netlist.outputs.map((n) => (
              <th key={n} className="px-2 py-2 font-normal text-ink">
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const here = netlist.inputs.every((n) => Boolean(current[n]) === r.inputs[n]);
            const key = netlist.inputs.map((n) => (r.inputs[n] ? 1 : 0)).join('') || 'row';
            return (
              <tr key={key} className={cn('border-t border-line', here && 'bg-panel-2')}>
                {netlist.inputs.map((n) => (
                  <td key={n} className="px-2 py-1.5">
                    <BitBox on={r.inputs[n]} />
                  </td>
                ))}
                <td className="text-muted">→</td>
                {netlist.outputs.map((n) => (
                  <td key={n} className="px-2 py-1.5">
                    <BitBox on={r.outputs[n]} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
