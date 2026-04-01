import { brandedIdQueryParam } from "@pluralscape/validation";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { middleware } from "../trpc.js";

import { protectedProcedure } from "./auth.js";

/** Schema merged into every system-scoped procedure's input. */
const SystemIdInputSchema = z.object({
  systemId: brandedIdQueryParam("sys_"),
});

const enforceSystemAccess = middleware(async ({ ctx, getRawInput, next }) => {
  // ctx.auth is guaranteed non-null by protectedProcedure upstream, but the
  // base middleware type doesn't carry that narrowing. Guard defensively.
  if (!ctx.auth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  const rawInput = await getRawInput();
  const parsed = SystemIdInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "systemId is required and must be a valid sys_<uuid> identifier",
    });
  }

  const { systemId } = parsed.data;

  if (!ctx.auth.ownedSystemIds.has(systemId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "System not found" });
  }

  return next({ ctx: { systemId } });
});

export const systemProcedure = protectedProcedure
  .input(SystemIdInputSchema)
  .use(enforceSystemAccess);
