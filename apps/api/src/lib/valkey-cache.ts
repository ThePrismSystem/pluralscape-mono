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
    const raw = await this.client.get(this.key(k));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      logger.warn("valkey-cache: failed to parse JSON; treating as miss", {
        key: this.key(k),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async setJSON(k: string, value: unknown, ttlMs: number): Promise<void> {
    await this.client.set(this.key(k), JSON.stringify(value), "PX", ttlMs);
  }

  async delete(k: string): Promise<void> {
    await this.client.del(this.key(k));
  }
}
