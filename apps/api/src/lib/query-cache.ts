/**
 * Simple in-memory query cache with lazy TTL eviction and bounded size.
 *
 * Map-based, single-process only. Entries are evicted lazily on access
 * (no background timers). When maxSize is reached, expired entries are
 * swept first; if still at capacity the oldest entry is evicted (FIFO
 * via Map insertion order). Suitable for caching per-system settings and
 * field definitions where eventual consistency is acceptable.
 */

/** Default upper bound on cache entries to prevent unbounded memory growth. */
const DEFAULT_QUERY_CACHE_MAX_SIZE = 10_000;

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export class QueryCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number, maxSize: number = DEFAULT_QUERY_CACHE_MAX_SIZE) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  /** Get a cached value, or undefined if missing/expired. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /** Store a value with the configured TTL. Evicts entries when at capacity. */
  set(key: string, value: T): void {
    // Re-setting an existing key won't grow the map, so only evict for new keys
    if (!this.store.has(key) && this.store.size >= this.maxSize) {
      this.evictExpired();

      // Still at capacity after sweeping expired — drop the oldest entry (FIFO)
      if (this.store.size >= this.maxSize) {
        const oldest = this.store.keys().next().value;
        if (oldest !== undefined) {
          this.store.delete(oldest);
        }
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** Sweep all expired entries from the store. */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /** Remove a specific key (used on writes to invalidate). */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Remove all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Current number of entries (including possibly-expired ones). */
  get approximateSize(): number {
    return this.store.size;
  }
}
