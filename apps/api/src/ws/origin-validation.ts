/**
 * WebSocket origin validation for CSWSH (Cross-Site WebSocket Hijacking) prevention.
 *
 * Extracted from index.ts for testability.
 */

/**
 * Check whether a WebSocket upgrade request's Origin header is allowed.
 *
 * - In test/development, all origins are accepted.
 * - Null/undefined origin is accepted (non-browser clients like native apps and CLI tools
 *   don't send the Origin header; session token auth — not cookie-based — prevents CSWSH).
 * - In production, origin must be in the ALLOWED_ORIGINS comma-separated env var.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (process.env["NODE_ENV"] === "test" || process.env["NODE_ENV"] === "development") {
    return true;
  }

  if (!origin) {
    // Non-browser clients (native apps, CLI tools) don't send Origin.
    // This is safe because authentication uses session tokens, not cookies,
    // so CSWSH via ambient credentials is not possible.
    return true;
  }

  const allowed = process.env["ALLOWED_ORIGINS"]?.split(",") ?? [];
  return allowed.includes(origin);
}
