import { FAUCET_DRIP, clientIp, faucetConfig } from '@/lib/faucet/config';
import { getLimiters, inFlight } from '@/lib/faucet/state';
import { forkClient, fund } from '@tapebox/fork';
import { NextResponse } from 'next/server';
import { formatEther, getAddress, isAddress } from 'viem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, error: string, extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ ok: false, error, ...extra }, { status });
  if (typeof extra.retryAfterSeconds === 'number') {
    res.headers.set('retry-after', String(extra.retryAfterSeconds));
  }
  return res;
}

/** Public, secret-free status for the UI. */
export function GET() {
  const c = faucetConfig();
  return NextResponse.json({
    mode: process.env.TAPEBOX_RPC ? 'fork' : 'mock',
    drip: FAUCET_DRIP,
    addressLimit: c.addressLimit,
    addressWindowSeconds: c.addressWindowMs / 1000,
    ipLimit: c.ipLimit,
    ipWindowSeconds: c.ipWindowMs / 1000,
  });
}

export async function POST(req: Request) {
  const rpc = process.env.TAPEBOX_RPC;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, 'Send JSON like {"address": "0x..."}.');
  }
  const raw = (body as { address?: unknown } | null)?.address;
  if (typeof raw !== 'string' || !isAddress(raw.trim(), { strict: false })) {
    return err(400, 'That is not a valid 0x address.');
  }
  const trimmed = raw.trim();
  // Mixed case must be a valid checksum; all-lower or all-upper is accepted as is.
  if (/[a-f]/.test(trimmed.slice(2)) && /[A-F]/.test(trimmed.slice(2)) && !isAddress(trimmed)) {
    return err(400, 'Address checksum does not match. Paste it again or use lowercase.');
  }
  const address = getAddress(trimmed);
  if (address === '0x0000000000000000000000000000000000000000') {
    return err(400, 'The zero address cannot receive test tokens.');
  }

  const ip = clientIp(req.headers);
  const { address: byAddress, ip: byIp } = getLimiters();
  const key = address.toLowerCase();

  const waitAddr = byAddress.retryAfter(key);
  if (waitAddr > 0) {
    const s = Math.ceil(waitAddr / 1000);
    return err(429, `This address was funded recently. Try again in ${formatWait(s)}.`, {
      retryAfterSeconds: s,
    });
  }
  const waitIp = byIp.retryAfter(ip);
  if (waitIp > 0) {
    const s = Math.ceil(waitIp / 1000);
    return err(429, `Too many faucet requests from your network. Try again in ${formatWait(s)}.`, {
      retryAfterSeconds: s,
    });
  }
  if (inFlight.has(key)) return err(409, 'A drip for this address is already on its way.');

  const undoAddr = byAddress.hit(key);
  const undoIp = byIp.hit(ip);
  if (!rpc) {
    // No fork configured: the sandbox runs on its in-browser mock, which credits itself.
    return NextResponse.json({ ok: true, mock: true, address, ...FAUCET_DRIP, method: 'mock' });
  }
  inFlight.add(key);
  try {
    const client = forkClient(rpc, { adminToken: process.env.TAPEBOX_ADMIN_TOKEN });
    const r = await fund(client, address);
    return NextResponse.json({
      ok: true,
      address: r.address,
      okb: formatEther(r.okb),
      nand: r.nand.toString(),
      latch: r.latch.toString(),
      method: r.method,
    });
  } catch (e) {
    // Failed drips do not count against the limits. Never echo upstream errors: they can carry the RPC URL.
    undoAddr();
    undoIp();
    console.error('[faucet] fund failed:', e instanceof Error ? e.name : 'unknown error');
    return err(502, 'The sandbox fork did not accept the drip. Try again in a minute.');
  } finally {
    inFlight.delete(key);
  }
}

function formatWait(s: number) {
  if (s < 90) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 90) return `${m} min`;
  return `${Math.ceil(m / 60)} h`;
}
