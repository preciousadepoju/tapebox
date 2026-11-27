import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_FORK_PORT, FORK_BLOCK, UPSTREAM_RPCS } from '@tapebox/shared';
import { type ResultPromise, execa } from 'execa';

export interface ForkOptions {
  port?: number;
  host?: string;
  /** Upstream X Layer RPC. Defaults to the first of UPSTREAM_RPCS that answers. */
  forkUrl?: string;
  forkBlock?: bigint;
  /** Load a state dump produced by --dump-state (fast start, no upstream calls for cached state). */
  loadState?: string;
  /** Write state here on exit. */
  dumpState?: string;
  /** Path to the anvil binary. Defaults to $ANVIL_BIN, then ~/.foundry/bin, then PATH. */
  anvilBin?: string;
  /** Pipe anvil's own logs to this process's stdout. */
  verbose?: boolean;
  /** Extra raw anvil flags. */
  extraArgs?: string[];
}

export interface RunningFork {
  rpcUrl: string;
  process: ResultPromise;
  stop(): Promise<void>;
}

export function findAnvil(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.ANVIL_BIN) return process.env.ANVIL_BIN;
  const exe = process.platform === 'win32' ? 'anvil.exe' : 'anvil';
  const foundryHome = join(homedir(), '.foundry', 'bin', exe);
  if (existsSync(foundryHome)) return foundryHome;
  return exe; // rely on PATH
}

async function rpcAlive(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json()) as { result?: string };
    return typeof body.result === 'string';
  } catch {
    return false;
  }
}

/** First upstream RPC that answers eth_chainId. */
export async function pickUpstream(candidates: readonly string[] = UPSTREAM_RPCS): Promise<string> {
  for (const url of candidates) if (await rpcAlive(url)) return url;
  throw new Error(`No X Layer RPC reachable (tried ${candidates.join(', ')})`);
}

export function anvilArgs(o: ForkOptions & { forkUrl: string }): string[] {
  const args = [
    '--fork-url',
    o.forkUrl,
    '--fork-block-number',
    String(o.forkBlock ?? FORK_BLOCK),
    '--chain-id',
    '196',
    '--port',
    String(o.port ?? DEFAULT_FORK_PORT),
    '--host',
    o.host ?? '127.0.0.1',
    // X Layer txs are cheap; keep gas out of the way for builders.
    '--base-fee',
    '0',
    '--gas-price',
    '0',
    '--no-rate-limit',
  ];
  if (o.loadState) args.push('--load-state', o.loadState);
  if (o.dumpState) args.push('--dump-state', o.dumpState);
  if (o.extraArgs) args.push(...o.extraArgs);
  return args;
}

/** Start anvil forking X Layer mainnet at the pinned block and wait until it answers. */
export async function startFork(opts: ForkOptions = {}): Promise<RunningFork> {
  const port = opts.port ?? DEFAULT_FORK_PORT;
  const host = opts.host ?? '127.0.0.1';
  const rpcUrl = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`;

  if (await rpcAlive(rpcUrl, 500)) {
    throw new Error(`Something is already listening on ${rpcUrl}. Stop it or pass --port.`);
  }

  const forkUrl = opts.forkUrl ?? (await pickUpstream());
  const bin = findAnvil(opts.anvilBin);
  const child = execa(bin, anvilArgs({ ...opts, forkUrl }), {
    stdout: opts.verbose ? 'inherit' : 'pipe',
    stderr: opts.verbose ? 'inherit' : 'pipe',
    reject: false,
    // anvil writes --dump-state on SIGINT/SIGTERM, so give it time.
    forceKillAfterDelay: 15_000,
  });

  let exited = false;
  let exitInfo = '';
  const notFound = `anvil not found ("${bin}"). Install Foundry: https://book.getfoundry.sh/getting-started/installation (on Windows, use WSL or the prebuilt Windows binaries), or set ANVIL_BIN to the anvil executable.`;
  child.then((r) => {
    exited = true;
    const out = [r.stderr, r.stdout]
      .filter((s) => typeof s === 'string' && s)
      .join('\n')
      .trim();
    exitInfo =
      (r as { code?: string }).code === 'ENOENT' || /not recognized|not found|ENOENT/i.test(out)
        ? notFound
        : out || `exit code ${r.exitCode}`;
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`anvil exited during startup:\n${exitInfo}`);
    if (await rpcAlive(rpcUrl, 1000)) {
      return {
        rpcUrl,
        process: child,
        async stop() {
          if (exited) return;
          child.kill('SIGINT');
          await child;
        },
      };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  child.kill('SIGKILL');
  throw new Error('anvil did not become ready within 60s');
}
