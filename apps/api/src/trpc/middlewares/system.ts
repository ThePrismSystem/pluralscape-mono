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
  // protectedProcedure guarantees ctx.auth is non-null at runtime, but the
  // middleware type doesn't carry that narrowing. Optional chaining is used
  // defensively so a misconfiguration surfaces as NOT_FOUND, not a crash.
  const auth = ctx.auth;
  const { systemId } = input as z.infer<typeof SystemIdInputSchema>;

  if (!auth?.ownedSystemIds.has(systemId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "System not found" });
  }

  return next({ ctx: { systemId } });
});

export const systemProcedure = protectedProcedure
  .input(SystemIdInputSchema)
  .use(enforceSystemAccess);
