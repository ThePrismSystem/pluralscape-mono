/**
 * Simple in-memory query cache with lazy TTL eviction.
 *
 * Map-based, single-process only. Entries are evicted lazily on access
 * (no background timers). Suitable for caching per-system settings and
 * field definitions where eventual consistency is acceptable.
 */

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export class QueryCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
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

  /** Store a value with the configured TTL. */
  set(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
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
