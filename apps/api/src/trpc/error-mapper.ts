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
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unknown error",
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

  // result.error is a TRPCError produced by getTRPCErrorFromUnknown; the original
  // service-layer error is in result.error.cause. If it was already mapped
  // (e.g. thrown TRPCError passes through), cause is undefined/the same TRPCError.
  const originalCause = result.error.cause ?? result.error;
  const mapped = mapError(originalCause);

  // If the inner TRPCError was already correctly mapped (came from a thrown
  // TRPCError in user code or another middleware), its code won't be
  // INTERNAL_SERVER_ERROR from wrapping — trust the existing code.
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
