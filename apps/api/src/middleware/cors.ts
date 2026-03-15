import { cors } from "hono/cors";

import type { MiddlewareHandler } from "hono";

/**
 * CORS middleware. Reads allowed origins from CORS_ORIGIN env var
 * (comma-separated). When unset, no cross-origin requests are allowed.
 */
export const corsMiddleware: MiddlewareHandler = (c, next) => {
  const raw = process.env["CORS_ORIGIN"];
  if (!raw) {
    return next();
  }

  const origins = raw.split(",").map((o) => o.trim());

  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })(c, next);
};
