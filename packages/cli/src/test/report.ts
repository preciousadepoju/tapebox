import type { RunReport } from '@tapebox/shared';
import pc from 'picocolors';

// The report schema is the canonical shared contract; this module only renders it.
export type { CaseResult, CheckResult, RunReport } from '@tapebox/shared';

const bits = (b: boolean[]): string => b.map((x) => (x ? 1 : 0)).join('') || '-';

export function toJson(r: RunReport): string {
  return `${JSON.stringify(r, null, 2)}\n`;
}

export function toMarkdown(r: RunReport): string {
  const lines = [
    '# Tapebox test report',
    '',
    `**${r.passed}/${r.total}** passed in ${r.durationMs} ms.`,
    '',
    '| Test | Result | Checks | Detail |',
    '| --- | --- | --- | --- |',
  ];
  for (const c of r.cases) {
    const detail = c.error
      ? c.error
      : c.checks
          .filter((x) => !x.pass)
          .map((x) => `${x.name}: expected ${bits(x.expected)}, got ${bits(x.actual)}`)
          .join('; ') || 'all checks passed';
    const passed = c.checks.filter((x) => x.pass).length;
    lines.push(
      `| ${c.name} | ${c.pass ? '✅ pass' : '❌ fail'} | ${passed}/${c.checks.length} | ${detail} |`,
    );
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

export function toJUnit(r: RunReport): string {
  const suites = r.cases
    .map((c) => {
      const failures = c.error ? 1 : c.checks.filter((x) => !x.pass).length;
      const body = c.error
        ? `    <testcase name="${xml(c.name)}"><error message="${xml(c.error)}"/></testcase>`
        : (c.checks.length ? c.checks : [{ name: 'tapeout', pass: true, expected: [], actual: [] }])
            .map((x) =>
              x.pass
                ? `    <testcase name="${xml(`${c.name} / ${x.name}`)}"/>`
                : `    <testcase name="${xml(`${c.name} / ${x.name}`)}"><failure message="${xml(
                    `expected ${bits(x.expected)}, got ${bits(x.actual)}`,
                  )}"/></testcase>`,
            )
            .join('\n');
      const tests = Math.max(c.checks.length, 1);
      return `  <testsuite name="${xml(c.name)}" tests="${tests}" failures="${failures}" time="${(
        c.durationMs / 1000
      ).toFixed(3)}">\n${body}\n  </testsuite>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="tapebox" tests="${r.total}" failures="${r.failed}" time="${(
    r.durationMs / 1000
  ).toFixed(3)}">\n${suites}\n</testsuites>\n`;
}

export function toTerminal(r: RunReport): string {
  const out: string[] = [];
  for (const c of r.cases) {
    out.push(
      `${c.pass ? pc.green('✓') : pc.red('✗')} ${c.name}${c.circuitId ? pc.dim(` #${c.circuitId}`) : ''}`,
    );
    if (c.error) out.push(`    ${pc.red(c.error)}`);
    for (const x of c.checks) {
      if (!x.pass) {
        out.push(`    ${pc.red(`${x.name}: expected ${bits(x.expected)}, got ${bits(x.actual)}`)}`);
      }
    }
  }
  out.push('');
  out.push(
    `${r.failed === 0 ? pc.green('PASS') : pc.red('FAIL')}  ${r.passed}/${r.total} tests in ${r.durationMs} ms`,
  );
  return out.join('\n');
}
