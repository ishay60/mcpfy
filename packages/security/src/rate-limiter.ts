import { RateLimitError } from '@mcpfy/core';

export interface RateLimitOptions {
  perMinute?: number;
  maxConcurrent?: number;
}

interface BucketState {
  tokens: number;
  lastRefillMs: number;
  inFlight: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly perMinute: number;
  private readonly maxConcurrent: number;

  constructor(opts: RateLimitOptions = {}) {
    this.perMinute = opts.perMinute ?? 30;
    this.maxConcurrent = opts.maxConcurrent ?? 5;
  }

  async check(toolName: string, sessionId: string): Promise<void> {
    const key = `${sessionId}::${toolName}`;
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.perMinute, lastRefillMs: now, inFlight: 0 };
      this.buckets.set(key, bucket);
    }
    const elapsed = (now - bucket.lastRefillMs) / 60_000;
    bucket.tokens = Math.min(this.perMinute, bucket.tokens + elapsed * this.perMinute);
    bucket.lastRefillMs = now;

    if (bucket.inFlight >= this.maxConcurrent) {
      throw new RateLimitError(`Too many concurrent calls to ${toolName}`, {
        toolName,
        maxConcurrent: this.maxConcurrent,
      });
    }
    if (bucket.tokens < 1) {
      throw new RateLimitError(`Rate limit exceeded for ${toolName}`, {
        toolName,
        perMinute: this.perMinute,
      });
    }
    bucket.tokens -= 1;
    bucket.inFlight += 1;

    // best-effort release; the server pipeline currently does not signal completion,
    // so we time-release each in-flight slot after the typical timeout window.
    setTimeout(() => {
      const b = this.buckets.get(key);
      if (b && b.inFlight > 0) b.inFlight -= 1;
    }, 30_000).unref?.();
  }
}
