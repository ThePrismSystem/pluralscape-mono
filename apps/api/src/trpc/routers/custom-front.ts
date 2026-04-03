import {
  CreateCustomFrontBodySchema,
  UpdateCustomFrontBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveCustomFront,
  createCustomFront,
  deleteCustomFront,
  getCustomFront,
  listCustomFronts,
  restoreCustomFront,
  updateCustomFront,
} from "../../services/custom-front.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for custom front list queries. */
const MAX_LIST_LIMIT = 100;

const CustomFrontIdSchema = z.object({
  customFrontId: brandedIdQueryParam("cf_"),
});

export const customFrontRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateCustomFrontBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createCustomFront(
        ctx.db,
        ctx.systemId,
        { encryptedData: input.encryptedData },
        ctx.auth,
        audit,
      );
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(CustomFrontIdSchema)
    .query(async ({ ctx, input }) => {
      return getCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listCustomFronts(
        ctx.db,
        ctx.systemId,
        ctx.auth,
        input.cursor ?? undefined,
        input.limit,
      );
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(CustomFrontIdSchema.and(UpdateCustomFrontBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateCustomFront(
        ctx.db,
        ctx.systemId,
        input.customFrontId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(CustomFrontIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(CustomFrontIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(CustomFrontIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth, audit);
      return { success: true as const };
    }),
});
