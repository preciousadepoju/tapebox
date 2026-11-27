/**
 * In-memory sliding-window limiter. Good for one long-running server (or one serverless instance);
 * swap `store` for Redis/Upstash if the faucet ever runs on many instances at once.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly opts: {
      limit: number;
      windowMs: number;
      now?: () => number;
      maxKeys?: number;
    },
  ) {}

  private now() {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  private recent(key: string, t: number) {
    const list = (this.hits.get(key) ?? []).filter((at) => t - at < this.opts.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Milliseconds until `key` may try again (0 when allowed now). */
  retryAfter(key: string): number {
    const t = this.now();
    const list = this.recent(key, t);
    if (list.length < this.opts.limit) return 0;
    const oldest = list[list.length - this.opts.limit] ?? t;
    return Math.max(1, this.opts.windowMs - (t - oldest));
  }

  /** Record a hit. Returns a function that undoes it (used when funding fails). */
  hit(key: string): () => void {
    const t = this.now();
    const list = this.recent(key, t);
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > (this.opts.maxKeys ?? 100_000)) this.prune(t);
    return () => {
      const cur = this.hits.get(key);
      if (!cur) return;
      const idx = cur.lastIndexOf(t);
      if (idx >= 0) cur.splice(idx, 1);
      if (!cur.length) this.hits.delete(key);
    };
  }

  private prune(t: number) {
    for (const key of [...this.hits.keys()]) this.recent(key, t);
  }

  reset() {
    this.hits.clear();
  }
}
