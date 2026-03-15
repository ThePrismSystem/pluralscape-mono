import { HTTPException } from "hono/http-exception";

import type { ErrorHandler } from "hono";

const HTTP_INTERNAL_SERVER_ERROR = 500;

/**
 * Global error handler. Preserves HTTPException status codes and messages.
 * Returns a generic 500 in production to avoid leaking internals.
 * In development, includes the error message (but never the stack trace).
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const isProduction = process.env["NODE_ENV"] === "production";

  if (err instanceof HTTPException) {
    const status = err.status;
    if (status >= HTTP_INTERNAL_SERVER_ERROR) {
      console.error("[api] Unhandled error:", err);
    }
    const message =
      isProduction && status >= HTTP_INTERNAL_SERVER_ERROR ? "Internal Server Error" : err.message;
    return c.json({ error: message }, status);
  }

  console.error("[api] Unhandled error:", err);
  const message = isProduction ? "Internal Server Error" : err.message;
  return c.json({ error: message }, HTTP_INTERNAL_SERVER_ERROR);
};
