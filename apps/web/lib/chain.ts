import { DEFAULT_FORK_PORT, tapeboxFork } from '@tapebox/shared';
import { http, createPublicClient } from 'viem';

/** Browser-facing RPC: the public proxy (hosted) or a local `tapebox up`. Never the admin URL. */
export const PUBLIC_RPC =
  process.env.NEXT_PUBLIC_TAPEBOX_RPC || `http://127.0.0.1:${DEFAULT_FORK_PORT}`;

export const forkChain = tapeboxFork(PUBLIC_RPC);

export const publicClient = createPublicClient({
  chain: forkChain,
  // The proxy accepts batches of up to 50 calls; stay under it.
  transport: http(PUBLIC_RPC, { batch: { batchSize: 40, wait: 16 } }),
  pollingInterval: 1_000,
});

export function rpcHost() {
  try {
    return new URL(PUBLIC_RPC).host;
  } catch {
    return PUBLIC_RPC;
  }
}
