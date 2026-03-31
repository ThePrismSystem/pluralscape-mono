/**
 * Shared HTTP constants, types, and helpers for E2E tests.
 *
 * Single source of truth — all test files import from here
 * instead of declaring local HTTP_* constants.
 */
import type { APIResponse } from "@playwright/test";

// ── HTTP Status Constants ────────────────────────────────────────────

export const HTTP_OK = 200;
export const HTTP_CREATED = 201;
export const HTTP_NO_CONTENT = 204;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_NOT_FOUND = 404;
export const HTTP_CONFLICT = 409;
export const HTTP_UNPROCESSABLE = 422;
export const HTTP_TOO_MANY_REQUESTS = 429;

/** Default page size for pagination assertions. */
export const DEFAULT_PAGINATION_PAGE_SIZE = 2;

/** Default item count to create when testing pagination. */
export const DEFAULT_PAGINATION_ITEM_COUNT = 3;

// ── Shared Types ─────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/** Template literal type that enforces label matches method. */
export type EndpointLabel = `${HttpMethod} ${string}`;

// ── Branded Auth Headers ─────────────────────────────────────────────

declare const AuthHeaderBrand: unique symbol;

/**
 * Branded type ensuring the headers object contains an Authorization header.
 * Use `asAuthHeaders()` to create from a plain record.
 */
export type AuthHeaders = Record<string, string> & { readonly [AuthHeaderBrand]: true };

/** Brand a headers record as AuthHeaders. */
export function asAuthHeaders(headers: Record<string, string>): AuthHeaders {
  return headers as AuthHeaders;
}

// ── Response Parsing ─────────────────────────────────────────────────

/**
 * Parse a Playwright API response body as the given type.
 * Centralizes the `(await res.json()) as T` pattern.
 */
export async function parseJsonBody<T>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

// ── Polling ──────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_POLL_TIMEOUT_MS = 15_000;

/**
 * Poll a condition function until it returns true or timeout expires.
 * Use instead of hard sleeps in tests.
 */
export async function pollUntil(
  fn: () => Promise<boolean>,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  const { intervalMs = DEFAULT_POLL_INTERVAL_MS, timeoutMs = DEFAULT_POLL_TIMEOUT_MS } = opts;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`pollUntil timed out after ${String(timeoutMs)}ms`);
}
