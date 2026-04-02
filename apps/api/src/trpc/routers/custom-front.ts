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
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for custom front list queries. */
const MAX_LIST_LIMIT = 100;

const CustomFrontIdSchema = z.object({
  customFrontId: brandedIdQueryParam("cf_"),
});

export const customFrontRouter = router({
  create: systemProcedure.input(CreateCustomFrontBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createCustomFront(
      ctx.db,
      ctx.systemId,
      { encryptedData: input.encryptedData },
      ctx.auth,
      audit,
    );
  }),

  get: systemProcedure.input(CustomFrontIdSchema).query(async ({ ctx, input }) => {
    return getCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listCustomFronts(ctx.db, ctx.systemId, ctx.auth, input.cursor, input.limit);
    }),

  update: systemProcedure
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

  archive: systemProcedure.input(CustomFrontIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(CustomFrontIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(CustomFrontIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteCustomFront(ctx.db, ctx.systemId, input.customFrontId, ctx.auth, audit);
    return { success: true as const };
  }),
});
