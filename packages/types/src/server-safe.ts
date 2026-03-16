import type { ServerResponseData } from "./encryption.js";
import type { PaginatedResult } from "./pagination.js";

declare const __serverSafe: unique symbol;

/** Branded wrapper marking data as verified server-safe. */
export type ServerSafe<T> = T & { readonly [__serverSafe]: true };

/** Verify a single server entity is safe to return. */
export function serverSafe<T extends ServerResponseData>(data: T): ServerSafe<T>;
/** Verify an array of server entities is safe to return. */
export function serverSafe<T extends ServerResponseData>(
  data: readonly T[],
): ServerSafe<readonly T[]>;
/** Verify a paginated result of server entities is safe to return. */
export function serverSafe<T extends ServerResponseData>(
  data: PaginatedResult<T>,
): ServerSafe<PaginatedResult<T>>;
/** Identity implementation — zero runtime overhead. */
export function serverSafe(data: unknown): unknown {
  return data;
}
