import { cors } from "hono/cors";

import type { MiddlewareHandler } from "hono";

/**
 * Creates CORS middleware. Reads allowed origins from CORS_ORIGIN env var
 * (comma-separated) once at factory call time. When unset or all entries
 * are blank, no cross-origin requests are allowed.
 */
export function createCorsMiddleware(): MiddlewareHandler {
  const raw = process.env["CORS_ORIGIN"];
  if (!raw) {
    return (_, next) => next();
  }

  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (origins.length === 0) {
    return (_, next) => next();
  }

  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });
}
