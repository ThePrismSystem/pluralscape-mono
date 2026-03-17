import { HTTPException } from "hono/http-exception";

import { HTTP_BAD_REQUEST, HTTP_INTERNAL_SERVER_ERROR } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";

import type { ApiErrorCode, ApiErrorResponse } from "@pluralscape/types";
import type { Context, ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Maps HTTP status codes to the best-match ApiErrorCode for plain HTTPExceptions. */
const STATUS_TO_CODE: Readonly<Record<number, ApiErrorCode>> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "VALIDATION_ERROR",
  409: "CONFLICT",
  413: "BLOB_TOO_LARGE",
  415: "VALIDATION_ERROR",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  502: "SERVICE_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
  504: "SERVICE_UNAVAILABLE",
};

/** Returns the best-match ApiErrorCode, falling back by range (4xx/5xx). */
function codeForStatus(status: number): ApiErrorCode {
  const mapped = STATUS_TO_CODE[status];
  if (mapped) return mapped;
  return status >= HTTP_INTERNAL_SERVER_ERROR ? "INTERNAL_ERROR" : "VALIDATION_ERROR";
}

/** Safely extracts the requestId from context, falling back to a new UUID. */
function getRequestId(c: Context): string {
  const value: unknown = c.get("requestId");
  return typeof value === "string" ? value : crypto.randomUUID();
}

/** Builds a structured error response with production masking for 5xx. */
function formatError(
  c: Context,
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  isProduction: boolean,
  details?: unknown,
): Response {
  const mask = isProduction && status >= HTTP_INTERNAL_SERVER_ERROR;
  const body: ApiErrorResponse = {
    error: {
      code: mask ? "INTERNAL_ERROR" : code,
      message: mask ? "Internal Server Error" : message,
      ...(mask || details === undefined ? {} : { details }),
    },
    requestId,
  };
  // Status codes from HTTPException/ApiHttpError are already ContentfulStatusCode;
  // the number param avoids coupling callers to Hono's internal type.
  return c.json(body, status as ContentfulStatusCode);
}

/**
 * Global error handler. Returns structured error responses:
 *   { error: { code, message, details? }, requestId }
 *
 * In production, 5xx errors have their message masked and details stripped.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const isProduction = process.env["NODE_ENV"] === "production";
  const requestId = getRequestId(c);

  if (err instanceof ApiHttpError) {
    if (err.status >= HTTP_INTERNAL_SERVER_ERROR) {
      console.error("[api] Unhandled error:", err);
    }
    return formatError(c, err.status, err.code, err.message, requestId, isProduction, err.details);
  }

  // Check by name to avoid importing Zod as a dependency of the error handler
  if (err instanceof Error && err.name === "ZodError") {
    return formatError(
      c,
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Validation failed",
      requestId,
      isProduction,
      isProduction ? undefined : err,
    );
  }

  if (err instanceof HTTPException) {
    if (err.status >= HTTP_INTERNAL_SERVER_ERROR) {
      console.error("[api] Unhandled error:", err);
    }
    return formatError(
      c,
      err.status,
      codeForStatus(err.status),
      err.message,
      requestId,
      isProduction,
    );
  }

  // Unknown error — always 500
  console.error("[api] Unhandled error:", err);
  const message = isProduction
    ? "Internal Server Error"
    : err instanceof Error
      ? err.message
      : String(err);
  return formatError(
    c,
    HTTP_INTERNAL_SERVER_ERROR,
    "INTERNAL_ERROR",
    message,
    requestId,
    isProduction,
  );
};
