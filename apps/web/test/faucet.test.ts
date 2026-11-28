import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fund = vi.fn();
const forkClient = vi.fn((rpc: string, opts: { adminToken?: string }) => ({ rpc, opts }));
vi.mock('@tapebox/fork', () => ({ fund, forkClient }));

const { GET, POST } = await import('../app/api/faucet/route');
const { resetFaucetState } = await import('../lib/faucet/state');

const ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const TOKEN = 'test-admin-token-that-is-long-enough-000';

function req(body: unknown, ip = '203.0.113.7') {
  return new Request('http://localhost/api/faucet', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv('TAPEBOX_RPC', 'http://fork.internal:8080');
  vi.stubEnv('TAPEBOX_ADMIN_TOKEN', TOKEN);
  vi.stubEnv('FAUCET_ADDRESS_LIMIT', '1');
  vi.stubEnv('FAUCET_ADDRESS_WINDOW_SECONDS', '3600');
  vi.stubEnv('FAUCET_IP_LIMIT', '3');
  vi.stubEnv('FAUCET_IP_WINDOW_SECONDS', '3600');
  resetFaucetState();
  fund.mockReset();
  forkClient.mockClear();
  fund.mockImplementation(async (_c: unknown, address: string) => ({
    address,
    okb: 100n * 10n ** 18n,
    nand: 1000n,
    latch: 100n,
    method: 'storage',
  }));
});

afterEach(() => vi.unstubAllEnvs());

describe('POST /api/faucet', () => {
  it('funds through fund(forkClient(TAPEBOX_RPC, { adminToken }), address)', async () => {
    const res = await POST(req({ address: ADDR }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      okb: '100',
      nand: '1000',
      latch: '100',
      method: 'storage',
    });
    expect(forkClient).toHaveBeenCalledWith('http://fork.internal:8080', { adminToken: TOKEN });
    expect(fund).toHaveBeenCalledWith(forkClient.mock.results[0]?.value, ADDR);
  });

  it('never sends the admin token or RPC URL back to the client', async () => {
    const ok = await (await POST(req({ address: ADDR }))).text();
    fund.mockRejectedValueOnce(
      new Error(`request to http://fork.internal:8080 failed, Bearer ${TOKEN}`),
    );
    const bad = await (
      await POST(req({ address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' }))
    ).text();
    const info = await (await GET()).text();
    for (const text of [ok, bad, info]) {
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain('fork.internal');
    }
  });

  it('validates the address', async () => {
    for (const address of [
      undefined,
      42,
      '0x123',
      'hello',
      '0x0000000000000000000000000000000000000000',
    ]) {
      const res = await POST(req({ address }));
      expect(res.status).toBe(400);
    }
    expect((await POST(req('not json'))).status).toBe(400);
    // mixed case with a broken checksum
    expect(
      (await POST(req({ address: '0x70997970c51812dc3A010C7d01b50e0d17dc79C8' }))).status,
    ).toBe(400);
    // all lowercase is fine
    expect((await POST(req({ address: ADDR.toLowerCase() }))).status).toBe(200);
    expect(fund).toHaveBeenCalledTimes(1);
  });

  it('rate-limits per address, case-insensitively', async () => {
    expect((await POST(req({ address: ADDR }))).status).toBe(200);
    const again = await POST(req({ address: ADDR.toLowerCase() }, '198.51.100.9'));
    expect(again.status).toBe(429);
    expect(Number(again.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(fund).toHaveBeenCalledTimes(1);
  });

  it('rate-limits per IP across addresses', async () => {
    const addrs = [
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    ];
    const codes = [];
    for (const a of addrs) codes.push((await POST(req({ address: a }))).status);
    expect(codes).toEqual([200, 200, 200, 429]);
    expect((await POST(req({ address: addrs[3] }, '198.51.100.20'))).status).toBe(200);
  });

  it('does not count failed drips against the limits', async () => {
    fund.mockRejectedValueOnce(new Error('upstream down'));
    expect((await POST(req({ address: ADDR }))).status).toBe(502);
    expect((await POST(req({ address: ADDR }))).status).toBe(200);
  });

  it('rejects a second request for the same address while one is in flight', async () => {
    let release: () => void = () => {};
    fund.mockImplementationOnce(
      () =>
        new Promise((r) => {
          release = () => r({ address: ADDR, okb: 1n, nand: 1n, latch: 1n, method: 'storage' });
        }),
    );
    vi.stubEnv('FAUCET_ADDRESS_LIMIT', '5');
    resetFaucetState();
    const first = POST(req({ address: ADDR }));
    await new Promise((r) => setTimeout(r, 0));
    const second = await POST(req({ address: ADDR }));
    expect(second.status).toBe(409);
    release();
    expect((await first).status).toBe(200);
  });

  it('falls back to the mock (no fund call) when TAPEBOX_RPC is unset', async () => {
    vi.stubEnv('TAPEBOX_RPC', '');
    const res = await POST(req({ address: ADDR }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, mock: true });
    expect(fund).not.toHaveBeenCalled();
    expect(await (await GET()).json()).toMatchObject({ mode: 'mock' });
  });
});
