import { logger } from "../../lib/logger.js";

import type { RateLimitResult, RateLimitStore } from "../rate-limit-store.js";

const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

const KEY_PREFIX = "ps:rl:";

/**
 * Minimal interface for the Redis/Valkey client we need.
 *
 * Covers both the rate-limiter's atomic-INCR Lua path and the generic
 * K/V surface used by ValkeyCache. Declared here — not in a standalone
 * module — because the same ioredis instance backs both, and consumers
 * already import from this file.
 */
export interface ValkeyClient {
  eval(script: string, numkeys: number, ...args: string[]): Promise<unknown>;
  ping(): Promise<string>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<"OK" | null>;
  del(key: string): Promise<number>;
}

/** Valkey/Redis-backed rate limit store using atomic Lua script. */
export class ValkeyRateLimitStore implements RateLimitStore {
  private readonly client: ValkeyClient;

  constructor(client: ValkeyClient) {
    this.client = client;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const result = (await this.client.eval(
      RATE_LIMIT_LUA,
      1,
      `${KEY_PREFIX}${key}`,
      String(windowMs),
    )) as [number, number];

    const [count, pttl] = result;
    const resetAt = Date.now() + Math.max(pttl, 0);

    return { count, resetAt };
  }
}

/**
 * Bundle returned by {@link createValkeyStore} so callers can wire up both
 * the rate-limit store and the shared client slot (used by generic caches)
 * from a single connect+ping attempt.
 */
export interface ValkeyBundle {
  readonly rateLimitStore: ValkeyRateLimitStore;
  readonly client: ValkeyClient;
}

/**
 * Create a Valkey-backed rate-limit store + expose the underlying client,
 * or return null on connection failure so the caller can fall back to
 * in-memory stores without bringing down the server.
 */
export async function createValkeyStore(url: string): Promise<ValkeyBundle | null> {
  try {
    // Dynamic import to avoid hard dependency when Valkey is not used.
    // Variable indirection prevents TypeScript from resolving the module at compile time.
    const moduleName = "ioredis";
    const mod = (await import(moduleName)) as {
      default: new (url: string, opts: Record<string, unknown>) => ValkeyClient;
    };
    const Redis = mod.default;
    const client = new Redis(url, { maxRetriesPerRequest: 3 });
    // Verify connectivity before returning — ioredis connects lazily, so without
    // this ping a misconfigured URL would only surface on the first rate-limit check.
    await client.ping();
    return { rateLimitStore: new ValkeyRateLimitStore(client), client };
  } catch (error: unknown) {
    logger.warn(
      "Failed to connect to Valkey for rate limiting, falling back to in-memory store",
      error instanceof Error ? { err: error } : { error: String(error) },
    );
    return null;
  }
}
