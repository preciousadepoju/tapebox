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
