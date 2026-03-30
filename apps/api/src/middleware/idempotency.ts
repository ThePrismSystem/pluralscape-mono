import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_INTERNAL_SERVER_ERROR } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { getContextLogger } from "../lib/logger.js";

import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_KEY_MAX_LENGTH } from "./idempotency.constants.js";
import { MemoryIdempotencyStore } from "./stores/memory-idempotency-store.js";

import type { IdempotencyStore } from "./idempotency-store.js";
import type { MiddlewareHandler } from "hono";

let sharedStore: IdempotencyStore | undefined;

export function setIdempotencyStore(store: IdempotencyStore): void {
  sharedStore = store;
}

export function getIdempotencyStore(): IdempotencyStore | undefined {
  return sharedStore;
}

export function _resetIdempotencyStoreForTesting(): void {
  sharedStore = undefined;
}

export function createIdempotencyMiddleware(): MiddlewareHandler {
  const fallbackStore = new MemoryIdempotencyStore();

  return async (c, next) => {
    const idempotencyKey = c.req.header(IDEMPOTENCY_KEY_HEADER);
    if (!idempotencyKey) return next();

    if (idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        `Idempotency-Key must be at most ${String(IDEMPOTENCY_KEY_MAX_LENGTH)} characters`,
      );
    }

    const store = sharedStore ?? fallbackStore;
    const raw: unknown = c.get("auth");
    const auth = raw as { accountId?: string } | undefined;
    if (!auth?.accountId) return next();
    const accountId = auth.accountId;

    // Check cache
    const cached = await store.get(accountId, idempotencyKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Acquire lock
    const acquired = await store.acquireLock(accountId, idempotencyKey);
    if (!acquired) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "IDEMPOTENCY_CONFLICT",
        "A request with this idempotency key is already in progress",
      );
    }

    try {
      await next();
      const response = c.res;
      // Don't cache server errors — they're transient and should be retryable
      if (response.status >= HTTP_INTERNAL_SERVER_ERROR) return;
      const body = await response.clone().text();
      try {
        await store.set(accountId, idempotencyKey, {
          statusCode: response.status,
          body,
        });
      } catch (cacheErr: unknown) {
        const log = getContextLogger(c);
        log.warn("Failed to cache idempotency response", {
          accountId,
          idempotencyKey,
          err: cacheErr instanceof Error ? cacheErr : new Error(String(cacheErr)),
        });
      }
    } finally {
      await store.releaseLock(accountId, idempotencyKey);
    }
  };
}
