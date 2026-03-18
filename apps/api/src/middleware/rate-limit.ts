import { RATE_LIMITS } from "@pluralscape/types";

import { HTTP_TOO_MANY_REQUESTS } from "../http.constants.js";
import { isValidIpFormat } from "../lib/ip-validation.js";

import { MS_PER_SECOND } from "./middleware.constants.js";
import { MemoryRateLimitStore } from "./stores/memory-store.js";

import type { RateLimitStore } from "./rate-limit-store.js";
import type { ApiErrorResponse, RateLimitCategory } from "@pluralscape/types";
import type { Context, MiddlewareHandler } from "hono";

/** Global fallback key when proxy is untrusted or header is missing. */
const GLOBAL_KEY = "__global__";

interface RateLimiterOptions {
  /** Maximum requests per window. */
  readonly limit: number;
  /** Window duration in milliseconds. */
  readonly windowMs: number;
  /** Optional external store. Defaults to in-memory. */
  readonly store?: RateLimitStore;
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
  return ip && isValidIpFormat(ip) ? ip : GLOBAL_KEY;
}

/**
 * Fixed-window rate limiter keyed by client IP.
 * Emits standard X-RateLimit-* headers on every response.
 * Returns 429 with structured error body when limit is exceeded.
 *
 * When TRUST_PROXY is unset, all requests share a single global bucket
 * to avoid X-Forwarded-For spoofing. Set TRUST_PROXY=1 behind a reverse proxy.
 */
export function createRateLimiter(options: RateLimiterOptions): MiddlewareHandler {
  const store = options.store ?? new MemoryRateLimitStore();
  const { limit, windowMs } = options;

  return async (c, next) => {
    const clientKey = getClientKey(c);
    const result = await store.increment(clientKey, windowMs);

    // Set rate limit headers on all responses
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - result.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / MS_PER_SECOND)));

    if (result.count > limit) {
      // Return structured error directly to guarantee headers and body are
      // on the same response object (no reliance on pre-throw header propagation).
      const now = Date.now();
      const retryAfter = Math.ceil((result.resetAt - now) / MS_PER_SECOND);
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

/** Shared store instance, resolved at startup. */
let sharedStore: RateLimitStore | undefined;

/** Set the shared rate limit store (call at startup). */
export function setRateLimitStore(store: RateLimitStore): void {
  sharedStore = store;
}

/** Creates a rate limiter using the predefined limits for a given category. */
export function createCategoryRateLimiter(category: RateLimitCategory): MiddlewareHandler {
  const config = RATE_LIMITS[category];
  return createRateLimiter({ ...config, store: sharedStore });
}
