import { faucetConfig } from './config';
import { SlidingWindowLimiter } from './rate-limit';

let limiters: { address: SlidingWindowLimiter; ip: SlidingWindowLimiter } | undefined;

/** Addresses with a drip in progress, so double clicks do not fund twice. */
export const inFlight = new Set<string>();

export function getLimiters() {
  if (!limiters) {
    const c = faucetConfig();
    limiters = {
      address: new SlidingWindowLimiter({ limit: c.addressLimit, windowMs: c.addressWindowMs }),
      ip: new SlidingWindowLimiter({ limit: c.ipLimit, windowMs: c.ipWindowMs }),
    };
  }
  return limiters;
}

/** Forget all rate-limit state and re-read limits from env (tests). */
export function resetFaucetState() {
  limiters = undefined;
  inFlight.clear();
}
