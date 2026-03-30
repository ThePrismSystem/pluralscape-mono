import {
  IDEMPOTENCY_CACHE_TTL_SEC,
  IDEMPOTENCY_LOCK_TTL_SEC,
  IDEMPOTENCY_MEMORY_SWEEP_INTERVAL_MS,
} from "../idempotency.constants.js";

import type { CachedResponse, IdempotencyStore } from "../idempotency-store.js";

const MS_PER_SEC = 1_000;

interface CacheEntry {
  response: CachedResponse;
  expiresAt: number;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly locks = new Map<string, number>();
  private readonly sweepHandle: ReturnType<typeof setInterval>;

  constructor() {
    this.sweepHandle = setInterval(() => {
      this.sweep();
    }, IDEMPOTENCY_MEMORY_SWEEP_INTERVAL_MS);
    this.sweepHandle.unref();
  }

  private compositeKey(accountId: string, key: string): string {
    return `${accountId}:${key}`;
  }

  get(accountId: string, key: string): Promise<CachedResponse | null> {
    const ck = this.compositeKey(accountId, key);
    const entry = this.cache.get(ck);
    if (!entry) return Promise.resolve(null);
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(ck);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.response);
  }

  set(accountId: string, key: string, response: CachedResponse): Promise<void> {
    this.cache.set(this.compositeKey(accountId, key), {
      response,
      expiresAt: Date.now() + IDEMPOTENCY_CACHE_TTL_SEC * MS_PER_SEC,
    });
    return Promise.resolve();
  }

  acquireLock(accountId: string, key: string): Promise<boolean> {
    const ck = this.compositeKey(accountId, key);
    const existing = this.locks.get(ck);
    if (existing && Date.now() < existing) return Promise.resolve(false);
    this.locks.set(ck, Date.now() + IDEMPOTENCY_LOCK_TTL_SEC * MS_PER_SEC);
    return Promise.resolve(true);
  }

  releaseLock(accountId: string, key: string): Promise<void> {
    this.locks.delete(this.compositeKey(accountId, key));
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    clearInterval(this.sweepHandle);
    return Promise.resolve();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
    for (const [key, expiresAt] of this.locks) {
      if (now >= expiresAt) this.locks.delete(key);
    }
  }
}
