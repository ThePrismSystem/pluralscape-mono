import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { CursorInvalidError, PAGINATION, now } from "@pluralscape/types";

import { HTTP_BAD_REQUEST } from "../http.constants.js";

import { ApiHttpError } from "./api-error.js";

import type { PaginatedResult, PaginationCursor } from "@pluralscape/types";

/** HMAC key length in bytes (matches SHA-256 output). */
const CURSOR_HMAC_KEY_BYTES = 32;

/** Per-process ephemeral key for cursor HMAC (invalidated on server restart). */
const CURSOR_HMAC_KEY = randomBytes(CURSOR_HMAC_KEY_BYTES);

/** Compute HMAC for cursor payload integrity. */
function computeCursorMac(id: string, ts: number): Buffer {
  return createHmac("sha256", CURSOR_HMAC_KEY)
    .update(`${id}\0${String(ts)}`)
    .digest();
}

/** Encode an entity ID into a time-stamped, HMAC-signed pagination cursor. */
export function toCursor(id: string): PaginationCursor {
  const ts = now();
  const mac = computeCursorMac(id, ts).toString("base64url");
  const payload = JSON.stringify({ id, ts, mac });
  return Buffer.from(payload).toString("base64url") as PaginationCursor;
}

/**
 * Decode a pagination cursor back to the original entity ID.
 * Throws CursorInvalidError with reason "malformed" for tampered/invalid cursors,
 * or reason "expired" if the cursor is older than ttlMs.
 */
export function fromCursor(cursor: PaginationCursor, ttlMs: number): string {
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new CursorInvalidError("malformed", "Malformed pagination cursor");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).id !== "string" ||
    typeof (parsed as Record<string, unknown>).ts !== "number" ||
    typeof (parsed as Record<string, unknown>).mac !== "string"
  ) {
    throw new CursorInvalidError("malformed", "Malformed pagination cursor");
  }

  const { id, ts, mac } = parsed as { id: string; ts: number; mac: string };

  // Verify HMAC integrity (timing-safe)
  const expected = computeCursorMac(id, ts);
  const received = Buffer.from(mac, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new CursorInvalidError("malformed", "Malformed pagination cursor");
  }

  if (now() - ts > ttlMs) {
    throw new CursorInvalidError("expired");
  }

  return id;
}

export function parsePaginationLimit(
  raw: string | undefined,
  defaultLimit: number,
  maxLimit: number,
): number {
  const parsed = raw ? parseInt(raw, 10) : defaultLimit;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maxLimit) : defaultLimit;
}

/**
 * Parse a cursor query parameter, decoding the base64url payload and
 * validating that it has not expired. Returns the original entity ID
 * or undefined if no cursor was provided.
 *
 * Throws ApiHttpError 400 INVALID_CURSOR on malformed or expired cursors.
 */
export function parseCursor(cursorParam: string | undefined): string | undefined {
  if (!cursorParam) return undefined;
  try {
    return fromCursor(cursorParam as PaginationCursor, PAGINATION.cursorTtlMs);
  } catch (error: unknown) {
    if (error instanceof CursorInvalidError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", error.message);
    }
    throw error;
  }
}

// ── Composite cursor helpers (numeric sort value + string ID) ────────

/** Decoded composite cursor containing a numeric sort value and a string ID. */
export interface DecodedCompositeCursor {
  readonly sortValue: number;
  readonly id: string;
}

/** Encode a composite cursor from a numeric sort value and entity ID. */
export function toCompositeCursor(sortValue: number, id: string): PaginationCursor {
  return toCursor(JSON.stringify({ t: sortValue, i: id }));
}

/**
 * Decode a composite cursor back to sort value + entity ID.
 * Throws ApiHttpError 400 INVALID_CURSOR for invalid/expired/malformed cursors.
 * @param entityLabel — label for error messages (e.g. "poll", "vote", "message")
 */
export function fromCompositeCursor(cursor: string, entityLabel: string): DecodedCompositeCursor {
  let raw: string;
  try {
    raw = fromCursor(cursor as PaginationCursor, PAGINATION.cursorTtlMs);
  } catch (error: unknown) {
    if (error instanceof CursorInvalidError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", error.message);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", `Malformed ${entityLabel} cursor`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { t?: unknown }).t !== "number" ||
    typeof (parsed as { i?: unknown }).i !== "string"
  ) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", `Malformed ${entityLabel} cursor`);
  }
  const { t, i } = parsed as { t: number; i: string };
  return { sortValue: t, id: i };
}

/** Build a cursor-paginated result from rows fetched with limit+1. */
export function buildPaginatedResult<TRow, TResult extends { id: string }>(
  rows: readonly TRow[],
  limit: number,
  mapper: (row: TRow) => TResult,
): PaginatedResult<TResult> {
  if (limit <= 0) {
    return { data: [], nextCursor: null, hasMore: false, totalCount: null };
  }
  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map(mapper);
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem ? toCursor(lastItem.id) : null;
  return { data, nextCursor, hasMore, totalCount: null };
}

/**
 * Build a cursor-paginated result from rows fetched with limit+1,
 * using a composite cursor (numeric sort value + entity ID).
 *
 * @param sortValueExtractor Extracts the numeric sort value (typically a UnixMillis
 *   timestamp) from a mapped result item. All callers must use the same sort-value
 *   semantics — do not mix timestamps with position integers across cursor usages.
 */
export function buildCompositePaginatedResult<TRow, TResult extends { id: string }>(
  rows: readonly TRow[],
  limit: number,
  mapper: (row: TRow) => TResult,
  sortValueExtractor: (item: TResult) => number,
): PaginatedResult<TResult> {
  if (limit <= 0) {
    return { data: [], nextCursor: null, hasMore: false, totalCount: null };
  }
  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map(mapper);
  const lastItem = data[data.length - 1];
  const nextCursor =
    hasMore && lastItem ? toCompositeCursor(sortValueExtractor(lastItem), lastItem.id) : null;
  return { data, nextCursor, hasMore, totalCount: null };
}
