import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  // Workspace packages ship as TS source; bundle them into the published CLI.
  noExternal: [/^@tapebox\//],
});
