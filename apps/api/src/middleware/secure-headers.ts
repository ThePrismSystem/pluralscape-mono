import { secureHeaders as honoSecureHeaders } from "hono/secure-headers";

import { HSTS_MAX_AGE_SECONDS } from "./middleware.constants.js";

import type { MiddlewareHandler } from "hono";

/**
 * Creates security headers middleware. Wraps Hono's built-in secureHeaders()
 * with project-specific CSP and framing policies.
 *
 * HSTS is only enabled in production to avoid browser caching issues in dev.
 */
export function createSecureHeaders(): MiddlewareHandler {
  const isProduction = process.env["NODE_ENV"] === "production";

  return honoSecureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
    xFrameOptions: "DENY",
    strictTransportSecurity: isProduction
      ? `max-age=${String(HSTS_MAX_AGE_SECONDS)}; includeSubDomains; preload`
      : false,
  });
}
