import { classifyErrorDefault } from "@pluralscape/import-core";
import { APIError } from "pkapi.js";

import type { ClassifyContext } from "@pluralscape/import-core";
import type { ImportError } from "@pluralscape/types";

/** HTTP 401 Unauthorized — bearer token missing or invalid. Fatal: no retry helps. */
const HTTP_UNAUTHORIZED = 401;
/** HTTP 403 Forbidden — token lacks permission. Fatal: no retry helps. */
const HTTP_FORBIDDEN = 403;
/** HTTP 404 Not Found — may be transient when the engine is mid-sync. Non-fatal. */
const HTTP_NOT_FOUND = 404;
/** HTTP 429 Too Many Requests — PK is rate-limiting us. Non-fatal. */
const HTTP_RATE_LIMITED = 429;
/** Lower bound of the HTTP 5xx server-error range (inclusive). */
const HTTP_SERVER_ERROR_MIN = 500;
/** Upper bound of the HTTP 5xx server-error range (exclusive — next family starts at 600). */
const HTTP_SERVER_ERROR_MAX_EXCLUSIVE = 600;
/** Base for parseInt() on HTTP status codes. */
const DECIMAL_RADIX = 10;

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
    const parsed = Number.parseInt(raw, DECIMAL_RADIX);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isServerError(status: number): boolean {
  return status >= HTTP_SERVER_ERROR_MIN && status < HTTP_SERVER_ERROR_MAX_EXCLUSIVE;
}

export function classifyPkError(thrown: unknown, ctx: ClassifyContext): ImportError {
  if (thrown instanceof APIError) {
    const status = normaliseStatus(thrown.status);
    const messageSuffix = status ?? thrown.status ?? "???";
    const message = thrown.message ?? `PK API error (${String(messageSuffix)})`;

    // Auth failures are fatal and not recoverable — no point retrying with the same credentials
    if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
      return {
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        message,
        fatal: true,
        recoverable: false,
      };
    }

    // Rate limit, server errors, and 404 are non-fatal — may resolve on retry
    if (
      status === HTTP_RATE_LIMITED ||
      status === HTTP_NOT_FOUND ||
      (status !== undefined && isServerError(status))
    ) {
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
