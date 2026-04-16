import { MS_PER_SECOND, RATE_LIMITS } from "@pluralscape/types";
import { TRPCError } from "@trpc/server";

import { logger } from "../../lib/logger.js";
import { checkRateLimit } from "../../middleware/rate-limit.js";
import { middleware } from "../trpc.js";

import type { TRPCContext } from "../context.js";
import type { RateLimitCategory } from "@pluralscape/types";
import type { TRPCMiddlewareBuilder } from "@trpc/server";

/** Fallback key when IP is not available. */
const GLOBAL_KEY = "__global__";

type KeyExtractor = (ctx: Pick<TRPCContext, "auth" | "requestMeta">, input: unknown) => string;

// Once-flag to avoid per-request log spam when IP is unavailable
let ipFallbackWarningLogged = false;

/** Extract rate-limit key from client IP (default). */
export const ipKeyExtractor: KeyExtractor = (ctx) => {
  if (ctx.requestMeta.ipAddress) return ctx.requestMeta.ipAddress;
  if (!ipFallbackWarningLogged) {
    ipFallbackWarningLogged = true;
    logger.warn(
      "tRPC rate limiter: IP address unavailable, using global rate-limit bucket. " +
        "All unauthenticated requests share a single limit.",
    );
  }
  return GLOBAL_KEY;
};

/** Extract rate-limit key from authenticated account ID. */
export const accountKeyExtractor: KeyExtractor = (ctx) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }
  return ctx.auth.accountId;
};

interface TRPCRateLimitOptions {
  readonly limit: number;
  readonly windowMs: number;
  readonly keyPrefix: string;
  readonly keyExtractor?: KeyExtractor;
}

/**
 * Creates a tRPC middleware that enforces rate limiting.
 * Uses the same shared store as the Hono rate limiter.
 */
export function createTRPCRateLimiter(
  options: TRPCRateLimitOptions,
): TRPCMiddlewareBuilder<TRPCContext, object, object, unknown> {
  const { limit, windowMs, keyPrefix, keyExtractor = ipKeyExtractor } = options;
  return middleware(async ({ ctx, input, next }) => {
    const clientKey = keyExtractor(ctx, input);
    const key = `trpc:${keyPrefix}:${clientKey}`;
    const result = await checkRateLimit(key, limit, windowMs);
    if (!result.allowed) {
      const retryAfter = Math.ceil(result.retryAfterMs / MS_PER_SECOND);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many requests. Retry after ${String(retryAfter)} seconds.`,
      });
    }
    return next();
  });
}

/** Creates a tRPC rate limiter using the predefined limits for a given category. */
export function createTRPCCategoryRateLimiter(
  category: RateLimitCategory,
  keyExtractor?: KeyExtractor,
): TRPCMiddlewareBuilder<TRPCContext, object, object, unknown> {
  const config = RATE_LIMITS[category];
  return createTRPCRateLimiter({ ...config, keyPrefix: category, keyExtractor });
}
