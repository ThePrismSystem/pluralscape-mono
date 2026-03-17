import type { Brand } from "./ids.js";

/** Opaque cursor for cursor-based pagination. */
export type PaginationCursor = Brand<string, "PaginationCursor">;

/** A page of results from a cursor-based paginated query. */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: PaginationCursor | null;
  readonly hasMore: boolean;
  readonly totalCount: number | null;
}

/** Cast a branded ID to a PaginationCursor for use as a pagination token. */
export function toCursor(id: string): PaginationCursor {
  return id as PaginationCursor;
}

/** Parameters for offset-based pagination. */
export interface OffsetPaginationParams {
  readonly offset: number;
  readonly limit: number;
}
