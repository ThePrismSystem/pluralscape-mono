import { toCursor } from "@pluralscape/types";

import type { PaginatedResult } from "@pluralscape/types";

export function parsePaginationLimit(
  raw: string | undefined,
  defaultLimit: number,
  maxLimit: number,
): number {
  const parsed = raw ? parseInt(raw, 10) : defaultLimit;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maxLimit) : defaultLimit;
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
