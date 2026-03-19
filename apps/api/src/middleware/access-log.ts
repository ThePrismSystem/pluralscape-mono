import { getContextLogger } from "../lib/logger.js";

import type { MiddlewareHandler } from "hono";

/** Logs every HTTP request with method, path, status, and duration. */
export function accessLogMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    try {
      await next();
    } finally {
      const duration = Date.now() - start;
      const log = getContextLogger(c);
      log.info("HTTP request", {
        requestId: c.get("requestId") as string | undefined,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration,
      });
    }
  };
}
