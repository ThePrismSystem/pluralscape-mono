import type { ErrorHandler } from "hono";

const HTTP_INTERNAL_SERVER_ERROR = 500;

/**
 * Global error handler. Returns a generic 500 in production to avoid
 * leaking internals. In development, includes the error message
 * (but never the stack trace).
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const isProduction = process.env["NODE_ENV"] === "production";
  const message = isProduction ? "Internal Server Error" : err.message;

  return c.json({ error: message }, HTTP_INTERNAL_SERVER_ERROR);
};
