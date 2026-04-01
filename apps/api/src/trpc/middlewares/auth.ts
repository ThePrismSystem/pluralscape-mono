import { TRPCError } from "@trpc/server";

import { errorMapProcedure } from "../error-mapper.js";
import { middleware } from "../trpc.js";

const enforceAuth = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({ ctx: { auth: ctx.auth } });
});

/** Procedure requiring a valid session. Extends errorMapProcedure. */
export const protectedProcedure = errorMapProcedure.use(enforceAuth);
