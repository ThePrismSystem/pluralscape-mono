import { v7 as uuidv7 } from "uuid";

import { createRequestLogger } from "../lib/logger.js";

import type { MiddlewareHandler } from "hono";

/**
 * Generates a unique request ID per request, stores it on context,
 * sets the X-Request-Id response header, and attaches a child logger
 * with the requestId bound to every log line.
 */
export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const id = uuidv7();
    c.set("requestId", id);
    c.set("log", createRequestLogger(id));
    c.header("X-Request-Id", id);
    await next();
  };
}
