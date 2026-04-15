import { z } from "zod";

import { logger } from "../../lib/logger.js";
import {
  IDEMPOTENCY_CACHE_TTL_SEC,
  IDEMPOTENCY_KEY_PREFIX,
  IDEMPOTENCY_LOCK_PREFIX,
  IDEMPOTENCY_LOCK_TTL_SEC,
} from "../idempotency.constants.js";

import type { CachedResponse, IdempotencyStore } from "../idempotency-store.js";

const CachedResponseSchema = z.object({
  statusCode: z.number(),
  body: z.string(),
});

interface ValkeyClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: string[]): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
  disconnect(): Promise<void>;
}

/** Valkey/Redis-backed idempotency store using NX/EX commands. */
export class ValkeyIdempotencyStore implements IdempotencyStore {
  private readonly client: ValkeyClient;

  private constructor(client: ValkeyClient) {
    this.client = client;
  }

  static async create(url: string): Promise<ValkeyIdempotencyStore> {
    // Dynamic import to avoid hard dependency when Valkey is not used.
    // Variable indirection prevents TypeScript from resolving the module at compile time.
    const moduleName = "ioredis";
    const mod = (await import(moduleName)) as {
      default: new (url: string, opts: Record<string, unknown>) => ValkeyClient;
    };
    const client = new mod.default(url, { maxRetriesPerRequest: 3 });
    // Verify connectivity before returning — ioredis connects lazily.
    await client.ping();
    return new ValkeyIdempotencyStore(client);
  }

  private cacheKey(accountId: string, key: string): string {
    return `${IDEMPOTENCY_KEY_PREFIX}${accountId}:${key}`;
  }

  private lockKey(accountId: string, key: string): string {
    return `${IDEMPOTENCY_LOCK_PREFIX}${accountId}:${key}`;
  }

  async get(accountId: string, key: string): Promise<CachedResponse | null> {
    const raw = await this.client.get(this.cacheKey(accountId, key));
    if (!raw) return null;
    try {
      return CachedResponseSchema.parse(JSON.parse(raw));
    } catch {
      logger.warn("Corrupt idempotency cache entry, deleting", { accountId, key });
      await this.client.del(this.cacheKey(accountId, key));
      return null;
    }
  }

  async set(accountId: string, key: string, response: CachedResponse): Promise<void> {
    await this.client.set(
      this.cacheKey(accountId, key),
      JSON.stringify(response),
      "EX",
      String(IDEMPOTENCY_CACHE_TTL_SEC),
    );
  }

  async acquireLock(accountId: string, key: string): Promise<boolean> {
    const result = await this.client.set(
      this.lockKey(accountId, key),
      "1",
      "EX",
      String(IDEMPOTENCY_LOCK_TTL_SEC),
      "NX",
    );
    return result === "OK";
  }

  async releaseLock(accountId: string, key: string): Promise<void> {
    await this.client.del(this.lockKey(accountId, key));
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }
}
