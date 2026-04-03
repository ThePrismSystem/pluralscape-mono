import { initTRPC } from "@trpc/server";
import { z } from "zod/v4";

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
  sse: {
    ping: { enabled: true, intervalMs: 2_000 },
    client: { reconnectAfterInactivityMs: 5_000 },
  },
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    const zodError =
      error.code === "BAD_REQUEST" && cause instanceof z.ZodError ? z.treeifyError(cause) : null;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError,
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

// Base procedures (protectedProcedure, systemProcedure) are exported from
// their respective middleware modules: ./middlewares/auth.js and ./middlewares/system.js.
// They are NOT re-exported here to avoid circular dependencies
// (trpc.ts → auth.ts → error-mapper.ts → trpc.ts).
