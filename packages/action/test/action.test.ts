import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const action = read('../action.yml');
const sample = read('../examples/ci.yml');

describe('action.yml', () => {
  it('is a composite action', () => {
    expect(action).toMatch(/using:\s*['"]?composite/);
  });

  it('runs the tapebox test command', () => {
    expect(action).toContain('tapebox@');
    expect(action).toMatch(/\btest\b/);
    expect(action).toContain('--junit');
  });

  it('offers a chain-free mock path', () => {
    expect(action).toContain('--mock');
  });

  it('installs the foundry toolchain for the real-fork path', () => {
    expect(action).toContain('foundry-rs/foundry-toolchain');
    expect(action).toContain('actions/cache');
  });

  it('declares every referenced input and the junit output', () => {
    for (const name of ['tapebox-version', 'node-version', 'mock', 'rpc', 'junit']) {
      expect(action, name).toContain(`${name}:`);
    }
    expect(action).toMatch(/outputs:[\s\S]*\bjunit:/);
  });
});

describe('sample workflow', () => {
  it('references the action and uploads results', () => {
    expect(sample).toContain('packages/action');
    expect(sample).toContain('tapebox-results.xml');
  });
});
