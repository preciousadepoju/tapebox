import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

/**
 * The official TAP-02 conformance vectors are the ground truth for the encoder and simulator.
 * They are not vendored yet — drop the file at packages/tap02/vectors/vectors.json (see the
 * README there for where to get it and the expected shape), then replace the `it.todo` below
 * with a loop that asserts encode/eval against every vector.
 */
const vectorsPath = fileURLToPath(new URL('../vectors/vectors.json', import.meta.url));
const hasVectors = existsSync(vectorsPath);

describe('official TAP-02 vectors', () => {
  if (hasVectors) {
    it.todo('check encode() and evalBeat() against every official vector');
  } else {
    it.skip('add packages/tap02/vectors/vectors.json to enable (see vectors/README.md)', () => {});
  }
});
