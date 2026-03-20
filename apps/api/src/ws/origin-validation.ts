/**
 * WebSocket origin validation for CSWSH (Cross-Site WebSocket Hijacking) prevention.
 *
 * Extracted from index.ts for testability. Uses the shared origin matcher
 * which supports wildcard patterns (e.g., `*.example.com`).
 */

import { env } from "../env.js";
import { isOriginAllowed } from "../lib/origin-matcher.js";

/**
 * Check whether a WebSocket upgrade request's Origin header is allowed.
 *
 * - In test/development, all origins are accepted.
 * - Null/undefined origin is accepted (non-browser clients like native apps and CLI tools
 *   don't send the Origin header; session token auth — not cookie-based — prevents CSWSH).
 * - In production, origin must match the ALLOWED_ORIGINS comma-separated env var
 *   (supports wildcard patterns like `*.example.com`).
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
    return true;
  }

  if (!origin) {
    // Non-browser clients (native apps, CLI tools) don't send Origin.
    // This is safe because authentication uses session tokens, not cookies,
    // so CSWSH via ambient credentials is not possible.
    return true;
  }

  const allowed = env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) ?? [];
  return isOriginAllowed(origin, allowed);
}
