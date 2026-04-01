import { TRPCError } from "@trpc/server";

import { ApiHttpError } from "../lib/api-error.js";

import { middleware, publicProcedure } from "./trpc.js";

/** Maps HTTP status codes to tRPC error codes. */
const HTTP_STATUS_TO_TRPC: Readonly<Record<number, TRPCError["code"]>> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  429: "TOO_MANY_REQUESTS",
};

/** Maps a service-layer error to the appropriate TRPCError. */
function mapError(error: unknown): TRPCError {
  if (error instanceof ApiHttpError) {
    const code = HTTP_STATUS_TO_TRPC[error.status] ?? "INTERNAL_SERVER_ERROR";
    return new TRPCError({ code, message: error.message, cause: error });
  }

  if (error instanceof Error && (error.name === "ZodError" || error.name === "ValidationError")) {
    return new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    cause: error,
  });
}

/**
 * Middleware that catches service-layer errors and re-throws them as TRPCError
 * with the appropriate error code. Applied to every procedure via
 * `errorMapProcedure`.
 *
 * tRPC wraps unhandled procedure errors as TRPCError with code
 * INTERNAL_SERVER_ERROR. We intercept those and re-map the original cause to a
 * more specific error code when possible.
 */
const errorMapper = middleware(async ({ next }) => {
  const result = await next();
  if (result.ok) return result;

  // Explicitly-coded errors were set intentionally — trust them as-is.
  if (result.error.code !== "INTERNAL_SERVER_ERROR") return result;

  // No cause means tRPC wrapped an error we can't improve on.
  if (!result.error.cause) return result;

  return { ...result, error: mapError(result.error.cause) };
});

/**
 * Base procedure with error mapping applied.
 * All other procedures (protectedProcedure, systemProcedure) extend from this.
 */
export const errorMapProcedure = publicProcedure.use(errorMapper);
