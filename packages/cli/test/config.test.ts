import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadConfig, parseConfig } from '../src/test/config.js';

const here = fileURLToPath(new URL('.', import.meta.url));

describe('parseConfig', () => {
  it('accepts a minimal config', () => {
    const c = parseConfig({
      tests: [{ name: 'x', circuit: { inputs: 2, outputs: 1, gates: [{ op: 0, a: 2, b: 3 }] } }],
    });
    expect(c.tests).toHaveLength(1);
  });

  it('rejects an empty test list', () => {
    expect(() => parseConfig({ tests: [] })).toThrow();
  });

  it('accepts a stateful test with beats', () => {
    const c = parseConfig({
      tests: [
        {
          name: 'toggle',
          circuit: { netlist: '0x01000007', inputs: 1, outputs: 1 },
          beats: [{ state: [0], in: [1], out: [1], newState: [1] }],
        },
      ],
    });
    expect(c.tests[0].beats).toHaveLength(1);
  });

  it('rejects a non-hex netlist', () => {
    expect(() =>
      parseConfig({ tests: [{ name: 'x', circuit: { netlist: 'nope', inputs: 1, outputs: 1 } }] }),
    ).toThrow();
  });
});

describe('loadConfig', () => {
  it('loads and validates a .mjs config', async () => {
    const c = await loadConfig(fileURLToPath(new URL('fixtures/good.config.mjs', import.meta.url)));
    expect(c.tests[0].name).toBe('NAND');
    expect(c.tests[0].truthTable).toHaveLength(2);
  });

  it('errors clearly when the file is missing', async () => {
    await expect(loadConfig('does-not-exist.mjs', here)).rejects.toThrow(/config not found/);
  });
});
