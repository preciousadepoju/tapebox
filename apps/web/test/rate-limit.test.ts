import { describe, expect, it } from 'vitest';
import { clientIp } from '../lib/faucet/config';
import { SlidingWindowLimiter } from '../lib/faucet/rate-limit';

describe('SlidingWindowLimiter', () => {
  it('allows `limit` hits per window, then reports the wait', () => {
    let t = 0;
    const l = new SlidingWindowLimiter({ limit: 2, windowMs: 1000, now: () => t });
    l.hit('a');
    t = 100;
    l.hit('a');
    expect(l.retryAfter('a')).toBe(900);
    expect(l.retryAfter('b')).toBe(0);
    t = 1000;
    expect(l.retryAfter('a')).toBe(0);
  });
  it('undo removes a hit', () => {
    const l = new SlidingWindowLimiter({ limit: 1, windowMs: 1000 });
    const undo = l.hit('a');
    expect(l.retryAfter('a')).toBeGreaterThan(0);
    undo();
    expect(l.retryAfter('a')).toBe(0);
  });
});

describe('clientIp', () => {
  it('prefers x-real-ip, then the first x-forwarded-for entry', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe(
      '1.1.1.1',
    );
    expect(clientIp(new Headers({ 'x-forwarded-for': '2.2.2.2, 10.0.0.1' }))).toBe('2.2.2.2');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
