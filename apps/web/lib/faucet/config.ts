function num(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Faucet limits. Read at call time so tests and deploys can change them through env vars. */
export function faucetConfig() {
  return {
    addressLimit: num('FAUCET_ADDRESS_LIMIT', 1),
    addressWindowMs: num('FAUCET_ADDRESS_WINDOW_SECONDS', 6 * 3600) * 1000,
    ipLimit: num('FAUCET_IP_LIMIT', 5),
    ipWindowMs: num('FAUCET_IP_WINDOW_SECONDS', 3600) * 1000,
  };
}

/** What a request gets: matches fund()'s defaults, shown in the UI. */
export const FAUCET_DRIP = { okb: '100', nand: '1000', latch: '100' } as const;

/**
 * Best-effort client IP. Vercel and most proxies put the real client first in x-forwarded-for;
 * x-real-ip is checked first because some proxies set it to the connecting address.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || 'unknown';
}
