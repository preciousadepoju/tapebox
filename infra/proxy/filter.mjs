// Pure request policy for the public RPC proxy. No I/O, so it is unit-tested directly.

/** Prefixes of methods that can reset, rewind or mint on the shared fork. */
export const BLOCKED_PREFIXES = [
  'anvil_',
  'evm_',
  'hardhat_',
  'tenderly_',
  'debug_',
  'personal_',
  'admin_',
  'miner_',
];

/**
 * Exact methods that are blocked too: eth_sendTransaction / eth_sign* would let anyone spend from
 * anvil's unlocked dev accounts; the public must send signed raw transactions instead.
 */
export const BLOCKED_METHODS = new Set([
  'eth_sendTransaction',
  'eth_sign',
  'eth_signTransaction',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'eth_sendUnsignedTransaction',
]);

export const MAX_BATCH = 50;

export function isBlocked(method) {
  if (typeof method !== 'string') return true;
  if (BLOCKED_METHODS.has(method)) return true;
  return BLOCKED_PREFIXES.some((p) => method.startsWith(p));
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

/**
 * Decide what to do with a parsed JSON-RPC body.
 * Returns { forward: object|array|null, rejected: Map<index, errorObj>, isBatch }.
 * Admin callers (the faucet backend) bypass the method blocklist.
 */
export function screen(body, { admin = false } = {}) {
  const isBatch = Array.isArray(body);
  const calls = isBatch ? body : [body];
  if (calls.length === 0 || calls.length > (admin ? 1000 : MAX_BATCH)) {
    return {
      forward: null,
      rejected: new Map([[0, rpcError(null, -32600, `batch must have 1-${MAX_BATCH} calls`)]]),
      isBatch: false,
    };
  }
  const rejected = new Map();
  const allowed = [];
  calls.forEach((c, i) => {
    if (!c || typeof c !== 'object' || c.jsonrpc !== '2.0' || typeof c.method !== 'string') {
      rejected.set(i, rpcError(c?.id, -32600, 'invalid request'));
    } else if (!admin && isBlocked(c.method)) {
      rejected.set(
        i,
        rpcError(c.id, -32601, `method ${c.method} is not available on the public Tapebox sandbox`),
      );
    } else {
      allowed.push(c);
    }
  });
  return { forward: allowed.length ? (isBatch ? allowed : allowed[0]) : null, rejected, isBatch };
}

/** Merge upstream responses with rejections, preserving request order for batches. */
export function merge(body, upstream, rejected, isBatch) {
  if (!isBatch) return rejected.size ? rejected.get(0) : upstream;
  const byId = new Map(
    (Array.isArray(upstream) ? upstream : []).map((r) => [JSON.stringify(r.id), r]),
  );
  return body.map(
    (c, i) =>
      rejected.get(i) ??
      byId.get(JSON.stringify(c.id)) ??
      rpcError(c.id, -32603, 'no upstream response'),
  );
}

/** Fixed-window-free token bucket per key. */
export class RateLimiter {
  constructor({ perMinute = 600, burst = 120, now = () => Date.now() } = {}) {
    this.rate = perMinute / 60_000;
    this.burst = burst;
    this.now = now;
    this.buckets = new Map();
  }
  take(key, cost = 1) {
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: t };
    b.tokens = Math.min(this.burst, b.tokens + (t - b.at) * this.rate);
    b.at = t;
    const ok = b.tokens >= cost;
    if (ok) b.tokens -= cost;
    this.buckets.set(key, b);
    if (this.buckets.size > 50_000) this.buckets.clear(); // crude memory cap
    return ok;
  }
}
