import type { MiddlewareHandler } from "hono";

const HTTP_TOO_MANY_REQUESTS = 429;
const MS_PER_SECOND = 1000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Maximum requests per window. */
  readonly limit: number;
  /** Window duration in milliseconds. */
  readonly windowMs: number;
}

/**
 * In-memory sliding window rate limiter keyed by client IP.
 * Returns 429 + Retry-After header when limit is exceeded.
 *
 * NOTE: Auth routes with expensive Argon2id derivation should use
 * stricter limits than the global defaults.
 */
export function createRateLimiter(options: RateLimiterOptions): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();
  const { limit, windowMs } = options;

  return async (c, next) => {
    const forwarded = c.req.header("x-forwarded-for");
    const clientIp = forwarded?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();

    let entry = store.get(clientIp);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(clientIp, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / MS_PER_SECOND);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too many requests" }, HTTP_TOO_MANY_REQUESTS);
    }

    return next();
  };
}
