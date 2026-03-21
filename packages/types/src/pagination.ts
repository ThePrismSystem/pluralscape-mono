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
export class CursorInvalidError extends Error {
  override readonly name = "CursorInvalidError" as const;
  readonly reason: "expired" | "malformed";

  constructor(
    reason: "expired" | "malformed" = "expired",
    message?: string,
    options?: ErrorOptions,
  ) {
    super(
      message ??
        (reason === "expired" ? "Pagination cursor has expired" : "Malformed pagination cursor"),
      options,
    );
    this.reason = reason;
  }
}

/** Parameters for offset-based pagination. */
export interface OffsetPaginationParams {
  readonly offset: number;
  readonly limit: number;
}
