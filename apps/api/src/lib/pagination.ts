import { CursorExpiredError, PAGINATION } from "@pluralscape/types";

import { ApiHttpError } from "./api-error.js";

import type { PaginatedResult, PaginationCursor } from "@pluralscape/types";

/** HTTP 400 status code. */
const HTTP_BAD_REQUEST = 400;

/** Encode an entity ID into a time-stamped pagination cursor. */
export function toCursor(id: string): PaginationCursor {
  const payload = JSON.stringify({ id, ts: Date.now() });
  return Buffer.from(payload).toString("base64url") as PaginationCursor;
}

/**
 * Decode a pagination cursor back to the original entity ID.
 * Throws CursorExpiredError if the cursor is older than ttlMs or malformed.
 */
export function fromCursor(cursor: PaginationCursor, ttlMs: number): string {
  let json: string;
  try {
    json = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new CursorExpiredError("Malformed pagination cursor");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new CursorExpiredError("Malformed pagination cursor");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).id !== "string" ||
    typeof (parsed as Record<string, unknown>).ts !== "number"
  ) {
    throw new CursorExpiredError("Malformed pagination cursor");
  }

  const { id, ts } = parsed as { id: string; ts: number };
  if (Date.now() - ts > ttlMs) {
    throw new CursorExpiredError();
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
    if (error instanceof CursorExpiredError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", error.message);
    }
    throw error;
  }
}

/** Build a cursor-paginated result from rows fetched with limit+1. */
export function buildPaginatedResult<TRow, TResult extends { id: string }>(
  rows: readonly TRow[],
  limit: number,
  mapper: (row: TRow) => TResult,
): PaginatedResult<TResult> {
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(mapper);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? toCursor(lastItem.id) : null;
  return { items, nextCursor, hasMore, totalCount: null };
}
