import { RATE_LIMITS } from "@pluralscape/types";

import type { ApiErrorResponse, RateLimitCategory } from "@pluralscape/types";
import type { Context, MiddlewareHandler } from "hono";

const HTTP_TOO_MANY_REQUESTS = 429;
const MS_PER_SECOND = 1000;

/** Evict expired entries when the store exceeds this size. */
const MAX_ENTRIES = 10_000;

/** Global fallback key when proxy is untrusted or header is missing. */
const GLOBAL_KEY = "__global__";

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
 * Extract a rate-limit key from the request.
 *
 * Only trusts X-Forwarded-For when TRUST_PROXY=1 is set. Without it,
 * all requests share a single global bucket to prevent IP spoofing.
 */
function getClientKey(c: Context): string {
  if (process.env["TRUST_PROXY"] !== "1") {
    return GLOBAL_KEY;
  }
  const forwarded = c.req.header("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip && ip.length > 0 ? ip : GLOBAL_KEY;
}

/**
 * In-memory fixed-window rate limiter keyed by client IP.
 * Emits standard X-RateLimit-* headers on every response.
 * Returns 429 with structured error body when limit is exceeded.
 *
 * When TRUST_PROXY is unset, all requests share a single global bucket
 * to avoid X-Forwarded-For spoofing. Set TRUST_PROXY=1 behind a reverse proxy.
 */
export function createRateLimiter(options: RateLimiterOptions): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();
  const { limit, windowMs } = options;

  return async (c, next) => {
    const now = Date.now();

    // Evict expired entries when the store grows too large
    if (store.size > MAX_ENTRIES) {
      for (const [key, entry] of store) {
        if (now >= entry.resetAt) {
          store.delete(key);
        }
      }
    }

    const clientKey = getClientKey(c);
    let entry = store.get(clientKey);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(clientKey, entry);
    }

    entry.count++;

    // Set rate limit headers on all responses
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / MS_PER_SECOND)));

    if (entry.count > limit) {
      // Return structured error directly to guarantee headers and body are
      // on the same response object (no reliance on pre-throw header propagation).
      const retryAfter = Math.ceil((entry.resetAt - now) / MS_PER_SECOND);
      c.header("Retry-After", String(retryAfter));
      const rawId: unknown = c.get("requestId");
      const requestId = typeof rawId === "string" ? rawId : crypto.randomUUID();
      return c.json(
        {
          error: { code: "RATE_LIMITED", message: "Too many requests" },
          requestId,
        } satisfies ApiErrorResponse,
        HTTP_TOO_MANY_REQUESTS,
      );
    }

    return next();
  };
}

/** Creates a rate limiter using the predefined limits for a given category. */
export function createCategoryRateLimiter(category: RateLimitCategory): MiddlewareHandler {
  return createRateLimiter(RATE_LIMITS[category]);
}
