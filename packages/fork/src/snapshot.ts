import { writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import type { ForkClient } from './fund.js';

/**
 * Write the fork's full state to a file that `anvil --load-state` accepts.
 * anvil_dumpState returns hex-encoded gzip of the state JSON; --load-state wants the plain JSON.
 */
export async function dumpStateToFile(client: ForkClient, path: string): Promise<number> {
  const hex = await client.dumpState();
  const raw = Buffer.from(hex.slice(2), 'hex');
  const json = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  await writeFile(path, json);
  return json.length;
}
