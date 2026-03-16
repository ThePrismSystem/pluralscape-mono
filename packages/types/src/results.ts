import type { ApiErrorCode } from "./api-constants.js";

/** Discriminated success/error union. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Structured API error. */
export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/** Full error response envelope per api-specification.md Section 2. */
export interface ApiErrorResponse {
  readonly error: ApiError;
  readonly requestId: string;
}

/** Discriminated API response — exactly one of `data` or `error` is non-null. */
export type ApiResponse<T> =
  | { readonly data: T; readonly error: null }
  | { readonly data: null; readonly error: ApiError };

/** A single field-level validation error. */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}
