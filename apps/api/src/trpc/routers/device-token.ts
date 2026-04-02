import { RegisterDeviceTokenBodySchema, brandedIdQueryParam } from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  deleteDeviceToken,
  listDeviceTokens,
  registerDeviceToken,
  revokeDeviceToken,
} from "../../services/device-token.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for device token list queries. */
const MAX_LIST_LIMIT = 100;

const TokenIdSchema = z.object({
  tokenId: brandedIdQueryParam("dt_"),
});

export const deviceTokenRouter = router({
  register: systemProcedure
    .input(RegisterDeviceTokenBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return registerDeviceToken(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listDeviceTokens(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
      });
    }),

  revoke: systemProcedure.input(TokenIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await revokeDeviceToken(ctx.db, ctx.systemId, input.tokenId, ctx.auth, audit);
    return { success: true as const };
  }),

  delete: systemProcedure.input(TokenIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteDeviceToken(ctx.db, ctx.systemId, input.tokenId, ctx.auth, audit);
    return { success: true as const };
  }),
});
