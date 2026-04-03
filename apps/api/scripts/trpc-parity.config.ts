/**
 * Configuration for the tRPC ↔ REST parity check script.
 *
 * ## REST-Only Allowlist
 *
 * Endpoints in this list intentionally have no tRPC equivalent.
 * Each entry documents the reason for exclusion.
 *
 * ### How to add a new exception
 *
 * 1. Add an entry to `REST_ONLY_ALLOWLIST` below.
 * 2. Use the exact `METHOD PATH` format from the REST route inventory
 *    (e.g. `"GET /v1/some/endpoint"`).
 * 3. Provide a short `reason` explaining why no tRPC counterpart exists.
 * 4. Run `pnpm trpc:parity` to verify the script still passes.
 */

export interface AllowlistEntry {
  /** HTTP method + full path, e.g. "GET /v1/notifications/stream". */
  readonly route: string;
  /** Human-readable reason this endpoint has no tRPC equivalent. */
  readonly reason: string;
}

/**
 * REST endpoints that intentionally have no tRPC counterpart.
 *
 * These are transport-specific (SSE, health checks) or infrastructure
 * endpoints that don't map to RPC-style procedure calls.
 */
export const REST_ONLY_ALLOWLIST: readonly AllowlistEntry[] = [
  {
    route: "GET /",
    reason: "Root status endpoint — infrastructure health, not a domain operation",
  },
  {
    route: "GET /health",
    reason: "Health check endpoint — infrastructure, not a domain operation",
  },
  {
    route: "GET /v1/notifications/stream",
    reason: "SSE notifications stream — transport-specific, tRPC uses subscriptions differently",
  },
];

/** Set of route keys for fast lookup. */
export const REST_ONLY_SET = new Set(REST_ONLY_ALLOWLIST.map((e) => e.route));
