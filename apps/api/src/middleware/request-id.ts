import type { MiddlewareHandler } from "hono";

/**
 * Generates a unique request ID per request, stores it on context,
 * and sets the X-Request-Id response header.
 */
export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const id = crypto.randomUUID();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  };
}
