import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

/** A bit may be written as 0/1 or a boolean in the config. */
const bit = z.union([z.literal(0), z.literal(1), z.boolean()]);

const gate = z.object({
  op: z.number().int().nonnegative(),
  a: z.number().int().nonnegative(),
  b: z.number().int().nonnegative(),
});

const circuit = z.union([
  z.object({
    inputs: z.number().int().nonnegative(),
    outputs: z.number().int().nonnegative(),
    gates: z.array(gate),
  }),
  z.object({
    netlist: z.string().regex(/^0x[0-9a-fA-F]*$/, 'netlist must be 0x-hex'),
    inputs: z.number().int().nonnegative(),
    outputs: z.number().int().nonnegative(),
  }),
]);

const testCase = z.object({
  name: z.string().min(1),
  circuit,
  /** Combinational checks: each row maps input bits to expected output bits. */
  truthTable: z.array(z.object({ in: z.array(bit), out: z.array(bit) })).optional(),
});

export const configSchema = z.object({
  /** Default fork RPC; overridden by --rpc. Omit to require --rpc or --mock. */
  rpc: z.string().url().optional(),
  tests: z.array(testCase).min(1),
});

export type TapeboxConfig = z.infer<typeof configSchema>;

/** Validate an already-loaded config object. */
export function parseConfig(input: unknown): TapeboxConfig {
  return configSchema.parse(input);
}

/** Typed identity helper for `tapebox.config.ts` authors. */
export function defineConfig(config: TapeboxConfig): TapeboxConfig {
  return config;
}

const DEFAULT_NAMES = ['tapebox.config.ts', 'tapebox.config.mjs', 'tapebox.config.js'];

/** Load `.ts` configs through jiti so no build step is needed. */
async function importTs(file: string): Promise<unknown> {
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url);
  return jiti.import(file, { default: true });
}

/**
 * Find and load the config (explicit path, or the first default name in `cwd`), then validate it.
 */
export async function loadConfig(explicit?: string, cwd = process.cwd()): Promise<TapeboxConfig> {
  const candidates = explicit
    ? [resolve(cwd, explicit)]
    : DEFAULT_NAMES.map((n) => resolve(cwd, n));
  const file = candidates.find((f) => existsSync(f));
  if (!file) {
    throw new Error(
      explicit
        ? `config not found: ${explicit}`
        : `no tapebox config found (looked for ${DEFAULT_NAMES.join(', ')} in ${cwd})`,
    );
  }
  const mod = file.endsWith('.ts')
    ? await importTs(file)
    : ((await import(pathToFileURL(file).href)) as { default?: unknown });
  const raw = mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod;
  return parseConfig(raw);
}
