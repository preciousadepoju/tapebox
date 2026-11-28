import type { Bits, Report, ReportCase } from '@tapebox/shared';
import pc from 'picocolors';

// The report schema is the shared cross-package contract (@tapebox/shared); this module renders it.
export type { Bits, Report, ReportCase, ReportSuite } from '@tapebox/shared';

const bitsStr = (b: Bits): string => {
  const v = Object.values(b);
  return v.length ? v.map((x) => (x ? 1 : 0)).join('') : '-';
};

export function toJson(r: Report): string {
  return `${JSON.stringify(r, null, 2)}\n`;
}

export function toMarkdown(r: Report): string {
  const { passed, failed, skipped } = r.summary;
  const lines = [
    '# Tapebox test report',
    '',
    `**${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}** in ${r.durationMs} ms (${r.chain.mode}).`,
    '',
    '| Suite | Case | Result | Detail |',
    '| --- | --- | --- | --- |',
  ];
  for (const s of r.suites) {
    for (const c of s.cases) {
      const mark = c.status === 'passed' ? '✅' : c.status === 'failed' ? '❌' : '⚪';
      const detail =
        c.message ??
        (c.status === 'failed' && c.actual
          ? `expected ${bitsStr(c.expected)}, got ${bitsStr(c.actual)}`
          : '');
      lines.push(`| ${s.name} | ${c.name} | ${mark} ${c.status} | ${detail} |`);
    }
  }
  return `${lines.join('\n')}\n`;
}

const xml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function junitCase(suiteName: string, c: ReportCase): string {
  const name = xml(`${suiteName} / ${c.name}`);
  if (c.status === 'passed') return `    <testcase name="${name}"/>`;
  if (c.status === 'skipped') return `    <testcase name="${name}"><skipped/></testcase>`;
  const msg =
    c.message ??
    (c.actual ? `expected ${bitsStr(c.expected)}, got ${bitsStr(c.actual)}` : 'failed');
  return `    <testcase name="${name}"><failure message="${xml(msg)}"/></testcase>`;
}

export function toJUnit(r: Report): string {
  const total = r.summary.passed + r.summary.failed + r.summary.skipped;
  const suites = r.suites
    .map((s) => {
      const failures = s.cases.filter((c) => c.status === 'failed').length;
      const body = s.cases.map((c) => junitCase(s.name, c)).join('\n');
      return `  <testsuite name="${xml(s.name)}" tests="${s.cases.length}" failures="${failures}">\n${body}\n  </testsuite>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="tapebox" tests="${total}" failures="${r.summary.failed}" time="${(
    r.durationMs / 1000
  ).toFixed(3)}">\n${suites}\n</testsuites>\n`;
}

export function toTerminal(r: Report): string {
  const out: string[] = [];
  for (const s of r.suites) {
    const ok = s.cases.every((c) => c.status !== 'failed');
    out.push(
      `${ok ? pc.green('✓') : pc.red('✗')} ${s.name}${s.circuitId ? pc.dim(` #${s.circuitId}`) : ''}`,
    );
    for (const c of s.cases) {
      if (c.status === 'failed') {
        const detail =
          c.message ??
          (c.actual ? `expected ${bitsStr(c.expected)}, got ${bitsStr(c.actual)}` : 'failed');
        out.push(`    ${pc.red(`${c.name}: ${detail}`)}`);
      }
    }
  }
  out.push('');
  const { passed, failed, skipped } = r.summary;
  out.push(
    `${failed === 0 ? pc.green('PASS') : pc.red('FAIL')}  ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''} in ${r.durationMs} ms`,
  );
  return out.join('\n');
}

/** A self-contained, shareable HTML report (no external assets; light + dark). */
export function toHtml(r: Report): string {
  const { passed, failed, skipped } = r.summary;
  const dot = (s: ReportCase['status']) => `<span class="dot ${s}" title="${s}"></span>${s}`;
  const suites = r.suites
    .map((s) => {
      const rows = s.cases
        .map((c) => {
          const detail = c.message ?? '';
          return `<tr class="${c.status}">
  <td>${xml(c.name)}</td>
  <td class="st">${dot(c.status)}</td>
  <td class="mono">${xml(bitsStr(c.inputs))}</td>
  <td class="mono">${xml(bitsStr(c.expected))}</td>
  <td class="mono">${c.actual ? xml(bitsStr(c.actual)) : '—'}</td>
  <td>${xml(detail)}</td>
</tr>`;
        })
        .join('\n');
      const fails = s.cases.filter((c) => c.status === 'failed').length;
      return `<section class="suite">
  <h2>${xml(s.name)} ${fails === 0 ? '<span class="ok">passed</span>' : `<span class="bad">${fails} failed</span>`}</h2>
  <div class="meta">${s.circuitId ? `circuit #${xml(s.circuitId)} · ` : ''}${s.gates.nand} NAND · ${s.gates.latch} LATCH</div>
  <table>
    <thead><tr><th>Case</th><th>Status</th><th>In</th><th>Expected</th><th>Actual</th><th>Note</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tapebox test report</title>
<style>
  :root { --bg:#fff; --fg:#1f2430; --mut:#5b6472; --line:#e3e6ec; --ok:#1e8e6a; --bad:#d64550; --skip:#9aa3af; --accent:#6b4ce6; }
  @media (prefers-color-scheme: dark) { :root { --bg:#14161c; --fg:#e7e9ee; --mut:#9aa3af; --line:#2a2f3a; } }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px; max-width:960px; margin:0 auto; background:var(--bg); color:var(--fg);
    font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
  h1 { font-size:22px; margin:0 0 2px; }
  .sub { color:var(--mut); margin-bottom:16px; }
  .badges { display:flex; gap:8px; margin:12px 0 24px; flex-wrap:wrap; }
  .badge { padding:4px 12px; border-radius:999px; font-weight:600; border:1px solid var(--line); }
  .badge.p { color:var(--ok); } .badge.f { color:var(--bad); } .badge.s { color:var(--skip); }
  .suite { border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-bottom:16px; }
  h2 { font-size:16px; margin:0 0 2px; }
  .ok { color:var(--ok); font-size:12px; } .bad { color:var(--bad); font-size:12px; }
  .meta { color:var(--mut); font-size:12px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--mut); font-weight:600; font-size:12px; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  tr.failed { background:color-mix(in srgb, var(--bad) 8%, transparent); }
  .st { white-space:nowrap; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; vertical-align:middle; }
  .dot.passed { background:var(--ok); } .dot.failed { background:var(--bad); } .dot.skipped { background:var(--skip); }
  footer { color:var(--mut); font-size:12px; margin-top:20px; }
</style>
</head>
<body>
  <h1>Tapebox test report</h1>
  <div class="sub">${xml(r.chain.mode)} · chain ${r.chain.chainId}${r.chain.forkBlock ? ` · block ${r.chain.forkBlock}` : ''} · ${xml(r.startedAt)} · ${r.durationMs} ms</div>
  <div class="badges">
    <span class="badge p">${passed} passed</span>
    <span class="badge f">${failed} failed</span>
    ${skipped ? `<span class="badge s">${skipped} skipped</span>` : ''}
  </div>
  ${suites}
  <footer>tapebox ${xml(r.version)} · report schema v${r.schemaVersion}</footer>
</body>
</html>
`;
}
