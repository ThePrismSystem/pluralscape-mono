import { brandedIdQueryParam } from "@pluralscape/validation";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { middleware } from "../trpc.js";

import { protectedProcedure } from "./auth.js";

/** Schema merged into every system-scoped procedure's input. */
const SystemIdInputSchema = z.object({
  systemId: brandedIdQueryParam("sys_"),
});

const enforceSystemAccess = middleware(async ({ ctx, input, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  const { systemId } = input as z.infer<typeof SystemIdInputSchema>;

  if (!ctx.auth.ownedSystemIds.has(systemId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "System not found" });
  }

  return next({ ctx: { systemId } });
});

export const systemProcedure = protectedProcedure
  .input(SystemIdInputSchema)
  .use(enforceSystemAccess);
