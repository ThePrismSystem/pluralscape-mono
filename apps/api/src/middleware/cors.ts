import { cors } from "hono/cors";

import { env } from "../env.js";
import { isOriginAllowed } from "../lib/origin-matcher.js";

import { CORS_MAX_AGE_SECONDS } from "./middleware.constants.js";

import type { MiddlewareHandler } from "hono";

/**
 * Creates CORS middleware. Reads allowed origins from CORS_ORIGIN env var
 * (comma-separated) once at factory call time. Supports wildcard patterns
 * (e.g., `*.example.com`). When unset or all entries are blank, no
 * cross-origin requests are allowed.
 */
export function createCorsMiddleware(): MiddlewareHandler {
  const raw = env.CORS_ORIGIN;
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

  if (origins.includes("*")) {
    throw new Error(
      'CORS_ORIGIN must not contain bare "*". Use explicit origins (e.g., "https://app.example.com") or wildcard subdomains (e.g., "*.example.com").',
    );
  }

  return cors({
    origin: (requestOrigin) => (isOriginAllowed(requestOrigin, origins) ? requestOrigin : null),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: CORS_MAX_AGE_SECONDS,
  });
}
