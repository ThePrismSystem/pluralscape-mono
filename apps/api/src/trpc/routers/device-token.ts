import {
  RegisterDeviceTokenBodySchema,
  UpdateDeviceTokenBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  deleteDeviceToken,
  listDeviceTokens,
  registerDeviceToken,
  revokeDeviceToken,
  updateDeviceToken,
} from "../../services/device-token.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { requireScope } from "../middlewares/scope.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for device token list queries. */
const MAX_LIST_LIMIT = 100;

const TokenIdSchema = z.object({
  tokenId: brandedIdQueryParam("dt_"),
});

export const deviceTokenRouter = router({
  register: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:notifications"))
    .input(RegisterDeviceTokenBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return registerDeviceToken(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  list: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:notifications"))
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listDeviceTokens(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:notifications"))
    .input(TokenIdSchema.and(UpdateDeviceTokenBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateDeviceToken(ctx.db, ctx.systemId, input.tokenId, input, ctx.auth, audit);
    }),

  revoke: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:notifications"))
    .input(TokenIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await revokeDeviceToken(ctx.db, ctx.systemId, input.tokenId, ctx.auth, audit);
      return { success: true as const };
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .use(requireScope("delete:notifications"))
    .input(TokenIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteDeviceToken(ctx.db, ctx.systemId, input.tokenId, ctx.auth, audit);
      return { success: true as const };
    }),
});
