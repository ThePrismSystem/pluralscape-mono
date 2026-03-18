import type { RateLimitResult, RateLimitStore } from "../rate-limit-store.js";

const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('PTTL', KEYS[1])}
`;

const KEY_PREFIX = "ps:rl:";

/** Minimal interface for the Redis/Valkey client we need. */
export interface ValkeyClient {
  eval(script: string, numkeys: number, ...args: string[]): Promise<unknown>;
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

/** Create a ValkeyRateLimitStore from a VALKEY_URL, or return null on failure. */
export async function createValkeyStore(url: string): Promise<ValkeyRateLimitStore | null> {
  try {
    // Dynamic import to avoid hard dependency when Valkey is not used.
    // Variable indirection prevents TypeScript from resolving the module at compile time.
    const moduleName = "ioredis";
    const mod = (await import(moduleName)) as {
      default: new (url: string, opts: Record<string, unknown>) => ValkeyClient;
    };
    const Redis = mod.default;
    const client = new Redis(url, { maxRetriesPerRequest: 3 });
    return new ValkeyRateLimitStore(client);
  } catch (error) {
    console.warn(
      "Failed to connect to Valkey for rate limiting, falling back to in-memory store:",
      error,
    );
    return null;
  }
}
