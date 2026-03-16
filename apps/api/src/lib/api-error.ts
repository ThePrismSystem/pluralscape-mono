import { HTTPException } from "hono/http-exception";

import type { ApiErrorCode } from "@pluralscape/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Structured API error that carries a typed error code and optional details.
 *
 * Named ApiHttpError to avoid collision with the ApiError interface in @pluralscape/types.
 * Route handlers throw this to produce consistent error responses:
 *
 *   throw new ApiHttpError(400, "VALIDATION_ERROR", "Invalid email", fieldErrors);
 */
export class ApiHttpError extends HTTPException {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    status: ContentfulStatusCode,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(status, { message });
    this.code = code;
    this.details = details;
  }
}
