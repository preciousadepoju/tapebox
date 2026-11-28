'use client';

import type { Bits, Parsed } from '@/lib/tnl';
import { useEffect, useMemo, useRef, useState } from 'react';

const ON = '#c6f432';
const OFF = '#3a4250';
const SIZE = {
  input: { w: 84, h: 34 },
  nand: { w: 110, h: 50 },
  latch: { w: 110, h: 50 },
  output: { w: 92, h: 34 },
} as const;

type Kind = keyof typeof SIZE;
interface Node {
  id: string;
  kind: Kind;
  label: string;
  x: number;
  y: number;
  value: boolean | undefined;
}
interface Edge {
  id: string;
  source: string;
  target: string;
  handle: string;
  value: boolean | undefined;
  feedback: boolean;
}

/** Column per logic depth (latches start a new column), rows centred in each column. */
export function layout(p: Parsed, v: Bits): { nodes: Node[]; edges: Edge[] } {
  const byOut = new Map(p.gates.map((g) => [g.out, g]));
  const depth = new Map<string, number>();
  for (const i of p.inputs) depth.set(i, 0);
  for (const g of p.gates) if (g.kind === 'latch') depth.set(g.out, 1);
  const visit = (name: string, seen = new Set<string>()): number => {
    const d = depth.get(name);
    if (d !== undefined) return d;
    const g = byOut.get(name);
    if (!g || seen.has(name)) return 0;
    seen.add(name);
    const r = 1 + Math.max(...g.ins.map((i) => visit(i, seen)));
    depth.set(name, r);
    return r;
  };
  for (const g of p.gates) visit(g.out);
  const maxDepth = Math.max(0, ...depth.values());
  const cols = new Map<number, string[]>();
  const put = (id: string, col: number) => cols.set(col, [...(cols.get(col) ?? []), id]);
  for (const i of p.inputs) put(`sig:${i}`, 0);
  for (const g of p.gates) put(`sig:${g.out}`, depth.get(g.out) ?? 1);
  for (const o of p.outputs) put(`out:${o}`, maxDepth + 1);
  const pos = new Map<string, { x: number; y: number }>();
  for (const [col, ids] of cols) {
    const top = -((ids.length - 1) * 90) / 2;
    ids.forEach((id, i) => pos.set(id, { x: col * 190, y: top + i * 90 }));
  }
  const at = (id: string) => pos.get(id) ?? { x: 0, y: 0 };
  const nodes: Node[] = [
    ...p.inputs.map((i) => ({
      id: `sig:${i}`,
      kind: 'input' as const,
      label: i,
      ...at(`sig:${i}`),
      value: v[i],
    })),
    ...p.gates.map((g) => ({
      id: `sig:${g.out}`,
      kind: g.kind,
      label: g.out,
      ...at(`sig:${g.out}`),
      value: v[g.out],
    })),
    ...p.outputs.map((o) => ({
      id: `out:${o}`,
      kind: 'output' as const,
      label: o,
      ...at(`out:${o}`),
      value: v[o],
    })),
  ];
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = [];
  for (const g of p.gates) {
    const handles = g.kind === 'nand' ? ['a', 'b'] : ['d', 'en'];
    g.ins.forEach((src, i) => {
      if (!ids.has(`sig:${src}`)) return;
      edges.push({
        id: `${src}->${g.out}:${handles[i]}`,
        source: `sig:${src}`,
        target: `sig:${g.out}`,
        handle: handles[i] ?? 'a',
        value: v[src],
        feedback: (depth.get(src) ?? 0) >= (depth.get(g.out) ?? 0),
      });
    });
  }
  for (const o of p.outputs) {
    if (ids.has(`sig:${o}`)) {
      edges.push({
        id: `${o}->out`,
        source: `sig:${o}`,
        target: `out:${o}`,
        handle: 'in',
        value: v[o],
        feedback: false,
      });
    }
  }
  return { nodes, edges };
}

function handleY(n: Node, handle: string) {
  if (n.kind === 'output') return n.y;
  const h = SIZE[n.kind].h;
  return handle === 'a' || handle === 'd' ? n.y - h * 0.2 : n.y + h * 0.2;
}

export function CircuitDiagram({
  netlist,
  values,
  onToggle,
}: {
  netlist: Parsed;
  values: Bits;
  onToggle: (name: string) => void;
}) {
  const { nodes, edges } = useMemo(() => layout(netlist, values), [netlist, values]);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 320 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const xs = nodes.flatMap((n) => [n.x - SIZE[n.kind].w / 2, n.x + SIZE[n.kind].w / 2]);
  const ys = nodes.flatMap((n) => [n.y - 40, n.y + 40]);
  const m = 30;
  const vb = {
    x: Math.min(...xs) - m,
    y: Math.min(...ys) - m,
    w: Math.max(...xs) - Math.min(...xs) + m * 2,
    h: Math.max(...ys) - Math.min(...ys) + m * 2,
  };
  const mono = 'JetBrains Mono, monospace';
  return (
    <div
      ref={box}
      className="absolute inset-0"
      style={{
        backgroundImage: 'radial-gradient(#262b33 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <svg
        width={size.w}
        height={size.h}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Circuit diagram"
      >
        <title>Circuit diagram</title>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {edges.map((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return null;
          const x1 = s.x + SIZE[s.kind].w / 2;
          const y1 = s.y;
          const x2 = t.x - SIZE[t.kind].w / 2;
          const y2 = handleY(t, e.handle);
          const low = Math.max(y1, y2) + 70;
          const d = e.feedback
            ? `M${x1},${y1} C${x1 + 50},${y1} ${x1 + 50},${low} ${(x1 + x2) / 2},${low} S${x2 - 50},${y2} ${x2},${y2}`
            : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
          return (
            <path
              key={e.id}
              d={d}
              fill="none"
              stroke={e.value ? ON : OFF}
              strokeWidth={2}
              strokeDasharray={e.feedback ? '6 4' : e.value ? '8 6' : undefined}
              filter={e.value ? 'url(#glow)' : undefined}
              className={e.value && !e.feedback ? 'tb-flow' : undefined}
            />
          );
        })}
        {nodes.map((n) => {
          const { w, h } = SIZE[n.kind];
          const on = Boolean(n.value);
          const rect = {
            x: n.x - w / 2,
            y: n.y - h / 2,
            width: w,
            height: h,
            fill: '#181c22',
            stroke: n.value === undefined ? '#262b33' : on ? ON : OFF,
            strokeWidth: 2,
          };
          if (n.kind === 'input') {
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                onClick={() => onToggle(n.label)}
                onKeyDown={(ev) => {
                  if (ev.key === ' ' || ev.key === 'Enter') {
                    ev.preventDefault();
                    onToggle(n.label);
                  }
                }}
                style={{ cursor: 'pointer' }}
                filter={on ? 'url(#glow)' : undefined}
              >
                <title>Click to toggle {n.label}</title>
                <rect {...rect} rx={h / 2} />
                <circle cx={n.x - w / 2 + 16} cy={n.y} r={5} fill={on ? ON : OFF} />
                <text
                  x={n.x + 6}
                  y={n.y + 4}
                  fill="#e7eaee"
                  fontSize={12}
                  fontFamily={mono}
                  textAnchor="middle"
                >
                  {n.label}
                </text>
              </g>
            );
          }
          if (n.kind === 'output') {
            return (
              <g key={n.id} filter={on ? 'url(#glow)' : undefined}>
                <rect {...rect} rx={6} />
                <text
                  x={n.x - 12}
                  y={n.y + 4}
                  fill="#e7eaee"
                  fontSize={12}
                  fontFamily={mono}
                  textAnchor="middle"
                >
                  {n.label}
                </text>
                <rect x={n.x + 18} y={n.y - 9} width={18} height={18} rx={3} fill={on ? ON : OFF} />
                <text
                  x={n.x + 27}
                  y={n.y + 4}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                  fill={on ? '#0b0d10' : '#e7eaee'}
                  fontFamily={mono}
                >
                  {on ? 1 : 0}
                </text>
              </g>
            );
          }
          return (
            <g key={n.id}>
              <rect {...rect} rx={6} strokeDasharray={n.kind === 'latch' ? '5 3' : undefined} />
              <text
                x={n.x}
                y={n.y - 5}
                fill="#8b94a1"
                fontSize={9}
                fontWeight={600}
                letterSpacing={1}
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
              >
                {n.kind.toUpperCase()}
              </text>
              <text
                x={n.x}
                y={n.y + 12}
                fill="#e7eaee"
                fontSize={12}
                textAnchor="middle"
                fontFamily={mono}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
