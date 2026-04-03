import { initTRPC } from "@trpc/server";
import { flattenError, ZodError } from "zod/v4";

import type { TRPCContext } from "./context.js";

/**
 * tRPC initialization. Shares one `t` instance across all routers.
 *
 * - errorFormatter: exposes field-level Zod validation details to clients
 * - isDev: controls stack trace inclusion in error responses
 *
 * Service errors are also caught by the errorMapper middleware (error-mapper.ts)
 * and re-thrown as TRPCError with the correct code.
 */
const t = initTRPC.context<TRPCContext>().create({
  isDev: process.env.NODE_ENV === "development",
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof ZodError
            ? flattenError(error.cause)
            : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/**
 * Factory for creating server-side callers (used in tests and internal logic).
 *
 * When using callers outside tests (e.g., cron jobs, webhooks), catch TRPCError
 * and use `getHTTPStatusCodeFromError` from `@trpc/server/http` to map errors
 * to HTTP status codes.
 */
export const createCallerFactory = t.createCallerFactory;

// Re-export base procedures from middleware files for discoverability.
// The canonical definitions live in their respective middleware modules.
export { protectedProcedure } from "./middlewares/auth.js";
export { systemProcedure } from "./middlewares/system.js";
