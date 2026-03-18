import { v7 as uuidv7 } from "uuid";

import type { MiddlewareHandler } from "hono";

/**
 * Generates a unique request ID per request, stores it on context,
 * and sets the X-Request-Id response header.
 */
export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const id = uuidv7();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  };
}
