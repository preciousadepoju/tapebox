import { createTapeboxSdk } from '@tapebox/sdk';
import { http } from 'viem';
import { PUBLIC_RPC } from './chain';
import { cpu } from './tapeout';

/**
 * One SDK bound to the browser-facing fork RPC. It shares the same batching transport the rest of
 * the UI uses (the public proxy caps batches at 50), so reads go through the real @tapebox/sdk
 * instead of hand-rolled readContract calls. Writes (tapeOut) still use the connected browser
 * wallet, so they stay on lib/tapeout.ts.
 */
export const sandboxSdk = createTapeboxSdk({
  rpcUrl: PUBLIC_RPC,
  cpu,
  transport: http(PUBLIC_RPC, { batch: { batchSize: 40, wait: 16 } }),
});
