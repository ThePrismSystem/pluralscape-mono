import { logger } from "./logger.js";

/**
 * Minimal Valkey/Redis client surface required by ValkeyCache.
 * Matches ioredis' `set(key, value, "PX", ttlMs)` overload for TTL writes.
 */
export interface ValkeyCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<"OK" | null>;
  del(key: string): Promise<number>;
}

/**
 * Generic namespaced JSON cache backed by a Valkey/Redis client.
 *
 * Every key is prefixed with `{namespace}:` so unrelated caches can coexist
 * on a single shared client without collision risk. Parse failures are
 * treated as misses — a corrupted entry never propagates as an error
 * because stale/garbled cache data must never break a live request.
 */
export class ValkeyCache {
  constructor(
    private readonly client: ValkeyCacheClient,
    private readonly namespace: string,
  ) {}

  private key(k: string): string {
    return `${this.namespace}:${k}`;
  }

  async getJSON<T>(k: string): Promise<T | null> {
    const prefixed = this.key(k);
    const raw = await this.client.get(prefixed);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      // Evict the corrupt entry so subsequent reads don't re-hit the same
      // unparseable payload indefinitely — a poisoned cache value must not
      // outlive a single failed parse.
      logger.warn("valkey-cache: failed to parse JSON; evicting corrupt entry", {
        key: prefixed,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.client.del(prefixed);
      return null;
    }
  }

  async setJSON(k: string, value: unknown, ttlMs: number): Promise<void> {
    await this.client.set(this.key(k), JSON.stringify(value), "PX", ttlMs);
  }

  /**
   * Write JSON best-effort. Logs and swallows failures so a transient Valkey
   * disconnect after a fresh upstream fetch doesn't fail the live request.
   *
   * Use this when the cache is an optimization (read-through proxy with a
   * fresh upstream result already in hand), not when the cache is the source
   * of truth — a silent failure there would mask real bugs.
   */
  async trySetJSON(k: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      await this.setJSON(k, value, ttlMs);
    } catch (error: unknown) {
      logger.warn("valkey-cache: setJSON failed, continuing", {
        key: this.key(k),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async delete(k: string): Promise<void> {
    await this.client.del(this.key(k));
  }
}
