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
  429: "TOO_MANY_REQUESTS",
};

/**
 * Maps a service-layer error to the appropriate TRPCError.
 * Returns null if the error is already a well-mapped TRPCError.
 */
function mapError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof ApiHttpError) {
    const code = HTTP_STATUS_TO_TRPC[error.status] ?? "INTERNAL_SERVER_ERROR";
    return new TRPCError({ code, message: error.message, cause: error });
  }

  if (error instanceof Error) {
    if (error.name === "ZodError" || error.name === "ValidationError") {
      return new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
    }

    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      cause: error,
    });
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
 * tRPC's internal `callRecursive` converts procedure errors to TRPCError before
 * returning them as `{ ok: false, error }` results. We intercept here by checking
 * the result and re-mapping the original cause.
 */
const errorMapper = middleware(async ({ next }) => {
  const result = await next();
  if (result.ok) {
    return result;
  }

  // If the error is a TRPCError with a specific (non-default) code, it was
  // explicitly thrown by a procedure or middleware — trust it as-is.
  // Only re-map errors with INTERNAL_SERVER_ERROR, which is tRPC's default
  // wrapper for unknown errors that need our custom mapping.
  if (result.error.code !== "INTERNAL_SERVER_ERROR") {
    return result;
  }

  const originalCause = result.error.cause ?? result.error;
  const mapped = mapError(originalCause);

  if (mapped === result.error) {
    return result;
  }

  return { ...result, error: mapped };
});

/**
 * Base procedure with error mapping applied.
 * All other procedures (protectedProcedure, systemProcedure) extend from this.
 */
export const errorMapProcedure = publicProcedure.use(errorMapper);
