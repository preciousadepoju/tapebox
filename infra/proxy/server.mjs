// Public JSON-RPC proxy in front of the shared anvil fork. Zero dependencies (Node 20+).
//   UPSTREAM      anvil URL              (default http://anvil:8545)
//   PORT          listen port            (default 8080)
//   ADMIN_TOKEN   bearer token that may call cheat methods (the faucet backend). Required.
//   RATE_PER_MIN  requests/min per IP    (default 600)
import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { RateLimiter, merge, screen } from './filter.mjs';

const UPSTREAM = process.env.UPSTREAM ?? 'http://anvil:8545';
const PORT = Number(process.env.PORT ?? 8080);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const MAX_BODY = 1_000_000;
const limiter = new RateLimiter({ perMinute: Number(process.env.RATE_PER_MIN ?? 600) });

if (ADMIN_TOKEN.length < 24) {
  console.error('ADMIN_TOKEN must be set (24+ chars). Generate one with: openssl rand -hex 32');
  process.exit(1);
}

function isAdmin(req) {
  const h = req.headers.authorization ?? '';
  const given = Buffer.from(h.startsWith('Bearer ') ? h.slice(7) : '');
  const want = Buffer.from(ADMIN_TOKEN);
  return given.length === want.length && timingSafeEqual(given, want);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (
    (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket.remoteAddress || '?'
  );
}

function send(res, status, obj) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST JSON-RPC only' });

  const admin = isAdmin(req);
  if (!admin && !limiter.take(clientIp(req))) {
    return send(res, 429, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32005, message: 'rate limited' },
    });
  }

  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) return send(res, 413, { error: 'body too large' });
    chunks.push(c);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return send(res, 400, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'parse error' },
    });
  }

  const { forward, rejected, isBatch } = screen(body, { admin });
  let upstream = null;
  if (forward) {
    try {
      const r = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(forward),
        signal: AbortSignal.timeout(30_000),
      });
      upstream = await r.json();
    } catch (e) {
      return send(res, 502, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'fork unavailable' },
      });
    }
  }
  const out =
    forward === null && !isBatch
      ? [...rejected.values()][0]
      : merge(body, upstream, rejected, isBatch);
  send(res, 200, out);
});

server.listen(PORT, () => console.log(`tapebox rpc proxy :${PORT} -> ${UPSTREAM}`));
