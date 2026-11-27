import { describe, expect, it } from 'vitest';
import { RateLimiter, isBlocked, merge, screen } from './filter.mjs';

const call = (method, id = 1) => ({ jsonrpc: '2.0', id, method, params: [] });

describe('isBlocked', () => {
  it('blocks every cheat namespace', () => {
    for (const m of [
      'anvil_setBalance',
      'anvil_reset',
      'evm_revert',
      'evm_snapshot',
      'hardhat_setStorageAt',
      'debug_traceTransaction',
      'anvil_impersonateAccount',
    ]) {
      expect(isBlocked(m), m).toBe(true);
    }
  });
  it('blocks spending from unlocked dev accounts', () => {
    expect(isBlocked('eth_sendTransaction')).toBe(true);
    expect(isBlocked('eth_sign')).toBe(true);
  });
  it('allows normal reads and signed sends', () => {
    for (const m of [
      'eth_call',
      'eth_getBalance',
      'eth_sendRawTransaction',
      'eth_chainId',
      'eth_getLogs',
      'eth_estimateGas',
    ]) {
      expect(isBlocked(m), m).toBe(false);
    }
  });
  it('blocks garbage', () => {
    expect(isBlocked(undefined)).toBe(true);
  });
});

describe('screen + merge', () => {
  it('rejects a single blocked call without forwarding', () => {
    const r = screen(call('anvil_setBalance'));
    expect(r.forward).toBeNull();
    expect(r.rejected.get(0).error.code).toBe(-32601);
  });
  it('lets admin call cheat methods', () => {
    const r = screen(call('anvil_setBalance'), { admin: true });
    expect(r.forward.method).toBe('anvil_setBalance');
    expect(r.rejected.size).toBe(0);
  });
  it('splits a mixed batch and restores order', () => {
    const body = [call('eth_chainId', 1), call('evm_revert', 2), call('eth_blockNumber', 3)];
    const r = screen(body);
    expect(r.forward.map((c) => c.id)).toEqual([1, 3]);
    const upstream = [
      { jsonrpc: '2.0', id: 3, result: '0x10' },
      { jsonrpc: '2.0', id: 1, result: '0xc4' },
    ];
    const out = merge(body, upstream, r.rejected, true);
    expect(out.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(out[0].result).toBe('0xc4');
    expect(out[1].error).toBeDefined();
  });
  it('caps batch size for the public', () => {
    const r = screen(Array.from({ length: 51 }, (_, i) => call('eth_chainId', i)));
    expect(r.forward).toBeNull();
  });
});

describe('RateLimiter', () => {
  it('allows a burst then refills over time', () => {
    let t = 0;
    const rl = new RateLimiter({ perMinute: 60, burst: 2, now: () => t });
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
    expect(rl.take('b')).toBe(true);
    t += 1000;
    expect(rl.take('a')).toBe(true);
  });
});
