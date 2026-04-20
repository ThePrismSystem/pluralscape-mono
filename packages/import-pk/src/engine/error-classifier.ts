import { classifyErrorDefault } from "@pluralscape/import-core";
import { APIError } from "pkapi.js";

import type { ClassifyContext } from "@pluralscape/import-core";
import type { ImportError } from "@pluralscape/types";

/** 401 Unauthorized / 403 Forbidden — fatal: no retry helps. */
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
/** 404 may resolve mid-sync as the engine completes prerequisite steps. */
const HTTP_NOT_FOUND = 404;
/** 429 — rate-limit, retry with backoff. */
const HTTP_RATE_LIMITED = 429;
/** Lower bound of the HTTP 5xx server-error range (inclusive). */
const HTTP_SERVER_ERROR_MIN = 500;
/** Upper bound of the HTTP 5xx server-error range (exclusive — next family starts at 600). */
const HTTP_SERVER_ERROR_MAX_EXCLUSIVE = 600;

/**
 * Normalise a pkapi.js `APIError.status` to a fixed numeric | undefined shape.
 *
 * pkapi.js types `status` as `string`, but the runtime value is copied from
 * axios' `response.status` — a number. Depending on fallback paths it can
 * also arrive as the literal string `"???"`, a number stringified, or
 * undefined. Normalising once at the top keeps every comparison branch
 * agnostic to the original shape.
 */
function normaliseStatus(raw: unknown): number | undefined {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : undefined;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * A status the engine should retry rather than surface as fatal: 429 (rate
 * limit), 404 (may resolve when the engine finishes a prior step), and any
 * 5xx (transient server-side failure).
 */
function isRetryableHttpStatus(status: number | undefined): boolean {
  if (status === undefined) return false;
  if (status === HTTP_RATE_LIMITED || status === HTTP_NOT_FOUND) return true;
  return status >= HTTP_SERVER_ERROR_MIN && status < HTTP_SERVER_ERROR_MAX_EXCLUSIVE;
}

/**
 * Build a stable suffix for the error message without coercing non-primitive
 * `thrown.status` shapes (arrays, objects) via String(). Falls back to `???`
 * rather than producing `[object Object]`.
 */
function formatStatusSuffix(normalised: number | undefined, raw: unknown): string {
  if (normalised !== undefined) return String(normalised);
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  return "???";
}

export function classifyPkError(thrown: unknown, ctx: ClassifyContext): ImportError {
  if (thrown instanceof APIError) {
    const status = normaliseStatus(thrown.status);
    const message = thrown.message ?? `PK API error (${formatStatusSuffix(status, thrown.status)})`;

    // 401/403: auth failures — no retry will succeed with the same credentials.
    if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
      return {
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        message,
        fatal: true,
        recoverable: false,
      };
    }

    // 429 rate limit, 404 mid-sync, and 5xx transient failures — may resolve on retry.
    if (isRetryableHttpStatus(status)) {
      return { entityType: ctx.entityType, entityId: ctx.entityId, message, fatal: false };
    }

    // Unknown API status (including missing/malformed) — treat as fatal but
    // potentially recoverable so the engine surfaces it without retry-looping.
    return {
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      message,
      fatal: true,
      recoverable: true,
    };
  }

  return classifyErrorDefault(thrown, ctx);
}
