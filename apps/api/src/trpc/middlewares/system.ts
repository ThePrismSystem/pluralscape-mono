import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { middleware } from "../trpc.js";

import { protectedProcedure } from "./auth.js";

import type { SystemId } from "@pluralscape/types";

/** Schema merged into every system-scoped procedure's input. */
const SystemIdInputSchema = z.object({
  systemId: z.string().startsWith("sys_"),
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
      message: "systemId is required and must start with 'sys_'",
    });
  }

  const systemId = parsed.data.systemId as SystemId;

  if (!ctx.auth.ownedSystemIds.has(systemId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "System not found" });
  }

  return next({ ctx: { systemId } });
});

export const systemProcedure = protectedProcedure
  .input(SystemIdInputSchema)
  .use(enforceSystemAccess);
