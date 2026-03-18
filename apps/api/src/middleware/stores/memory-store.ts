import { MAX_RATE_LIMIT_ENTRIES } from "../middleware.constants.js";

import type { RateLimitResult, RateLimitStore } from "../rate-limit-store.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** In-memory fixed-window rate limit store backed by a Map. */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();

  increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();

    // Evict expired entries when the store grows too large
    if (this.store.size > MAX_RATE_LIMIT_ENTRIES) {
      for (const [k, entry] of this.store) {
        if (now >= entry.resetAt) {
          this.store.delete(k);
        }
      }
    }

    let entry = this.store.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      this.store.set(key, entry);
    }

    entry.count++;

    return Promise.resolve({ count: entry.count, resetAt: entry.resetAt });
  }
}
