import { initTRPC } from "@trpc/server";

import type { TRPCContext } from "./context.js";

/**
 * tRPC initialization. Shares one `t` instance across all routers.
 *
 * Error formatting is handled by the errorMapper middleware (error-mapper.ts),
 * not the error formatter — service errors are caught and re-thrown as TRPCError
 * with the correct code before tRPC's formatter ever sees them.
 */
const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
