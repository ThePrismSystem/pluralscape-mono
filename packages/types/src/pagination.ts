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

/** Thrown when a pagination cursor is expired or malformed. */
export class CursorExpiredError extends Error {
  override readonly name = "CursorExpiredError" as const;

  constructor(message = "Pagination cursor has expired", options?: ErrorOptions) {
    super(message, options);
  }
}

/** Parameters for offset-based pagination. */
export interface OffsetPaginationParams {
  readonly offset: number;
  readonly limit: number;
}
