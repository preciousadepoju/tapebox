'use client';

import type { ParseError } from '@/lib/tnl';
import { useMemo, useRef } from 'react';

const KEYWORD = /^(\s*)(input|output|nand|latch)\b/i;

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Syntax colouring for one line; the textarea on top stays the source of truth. */
function highlight(line: string) {
  const hash = line.indexOf('#');
  const code = hash >= 0 ? line.slice(0, hash) : line;
  const comment = hash >= 0 ? line.slice(hash) : '';
  const m = code.match(KEYWORD);
  let html = esc(code);
  if (m) {
    const kw = (m[2] ?? '').toLowerCase();
    const cls = kw === 'nand' || kw === 'latch' ? 'text-accent font-semibold' : 'text-sky-300';
    html = `${esc(m[1] ?? '')}<span class="${cls}">${esc(m[2] ?? '')}</span>${esc(code.slice(m[0].length))}`;
  }
  return html + (comment ? `<span class="text-muted">${esc(comment)}</span>` : '');
}

export function NetlistEditor({
  value,
  onChange,
  errors,
}: {
  value: string;
  onChange: (v: string) => void;
  errors: ParseError[];
}) {
  const pre = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n');
  const byLine = useMemo(() => new Map(errors.map((e) => [e.line, e.message])), [errors]);
  const sync = (el: HTMLTextAreaElement) => {
    if (pre.current) {
      pre.current.scrollTop = el.scrollTop;
      pre.current.scrollLeft = el.scrollLeft;
    }
    if (gutter.current) gutter.current.scrollTop = el.scrollTop;
  };
  const mono = 'font-mono text-[13px] leading-[20px]';
  return (
    <div className="flex h-full bg-panel">
      <div
        ref={gutter}
        className={`select-none overflow-hidden py-3 pr-2 pl-3 text-right text-muted/70 ${mono}`}
      >
        {lines.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are positional
          <div key={i} title={byLine.get(i + 1)} className={byLine.has(i + 1) ? 'text-danger' : ''}>
            {byLine.has(i + 1) ? '●' : i + 1}
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <pre
          ref={pre}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre py-3 pr-3 ${mono}`}
        >
          {lines.map((l, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
              key={i}
              className={
                byLine.has(i + 1)
                  ? 'bg-red-500/10 underline decoration-danger decoration-wavy underline-offset-4'
                  : ''
              }
              // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped above, colouring only
              dangerouslySetInnerHTML={{ __html: highlight(l) || ' ' }}
            />
          ))}
        </pre>
        <textarea
          aria-label="Netlist"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => sync(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key !== 'Tab') return;
            e.preventDefault();
            const el = e.currentTarget;
            const at = el.selectionStart;
            onChange(`${value.slice(0, at)}  ${value.slice(el.selectionEnd)}`);
            requestAnimationFrame(() => el.setSelectionRange(at + 2, at + 2));
          }}
          className={`absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent py-3 pr-3 text-transparent caret-accent outline-none ${mono}`}
        />
      </div>
    </div>
  );
}
