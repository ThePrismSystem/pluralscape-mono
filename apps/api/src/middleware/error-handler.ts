import { HTTPException } from "hono/http-exception";

import { ApiHttpError } from "../lib/api-error.js";

import type { ApiErrorCode, ApiErrorResponse } from "@pluralscape/types";
import type { ErrorHandler } from "hono";

const HTTP_INTERNAL_SERVER_ERROR = 500;

/** Maps HTTP status codes to the best-match ApiErrorCode for plain HTTPExceptions. */
const STATUS_TO_CODE: Readonly<Record<number, ApiErrorCode>> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "BLOB_TOO_LARGE",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

function codeForStatus(status: number): ApiErrorCode {
  return STATUS_TO_CODE[status] ?? "INTERNAL_ERROR";
}

/**
 * Global error handler. Returns structured error responses:
 *   { error: { code, message, details? }, requestId }
 *
 * In production, 5xx errors have their message masked and details stripped.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const isProduction = process.env["NODE_ENV"] === "production";
  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();

  if (err instanceof ApiHttpError) {
    const status = err.status;
    if (status >= HTTP_INTERNAL_SERVER_ERROR) {
      console.error("[api] Unhandled error:", err);
    }

    const mask = isProduction && status >= HTTP_INTERNAL_SERVER_ERROR;
    const body: ApiErrorResponse = {
      error: {
        code: mask ? "INTERNAL_ERROR" : err.code,
        message: mask ? "Internal Server Error" : err.message,
        details: mask ? undefined : err.details,
      },
      requestId,
    };
    return c.json(body, status);
  }

  if (err instanceof HTTPException) {
    const status = err.status;
    if (status >= HTTP_INTERNAL_SERVER_ERROR) {
      console.error("[api] Unhandled error:", err);
    }

    const mask = isProduction && status >= HTTP_INTERNAL_SERVER_ERROR;
    const body: ApiErrorResponse = {
      error: {
        code: mask ? "INTERNAL_ERROR" : codeForStatus(status),
        message: mask ? "Internal Server Error" : err.message,
        details: undefined,
      },
      requestId,
    };
    return c.json(body, status);
  }

  // Unknown error — always 500
  console.error("[api] Unhandled error:", err);
  const message = isProduction ? "Internal Server Error" : (err as Error).message;
  const body: ApiErrorResponse = {
    error: {
      code: "INTERNAL_ERROR",
      message,
      details: undefined,
    },
    requestId,
  };
  return c.json(body, HTTP_INTERNAL_SERVER_ERROR);
};
