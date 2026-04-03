import {
  DuplicateSystemBodySchema,
  PurgeSystemBodySchema,
  UpdateSystemBodySchema,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { duplicateSystem } from "../../services/system-duplicate.service.js";
import { purgeSystem } from "../../services/system-purge.service.js";
import {
  archiveSystem,
  createSystem,
  getSystemProfile,
  listSystems,
  updateSystemProfile,
} from "../../services/system.service.js";
import { protectedProcedure } from "../middlewares/auth.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for system list queries. */
const MAX_LIST_LIMIT = 100;

export const systemRouter = router({
  create: protectedProcedure.use(writeLimiter).mutation(async ({ ctx }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createSystem(ctx.db, ctx.auth, audit);
  }),

  get: systemProcedure.use(readLimiter).query(async ({ ctx }) => {
    return getSystemProfile(ctx.db, ctx.systemId, ctx.auth);
  }),

  list: protectedProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listSystems(ctx.db, ctx.auth.accountId, input.cursor, input.limit);
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(UpdateSystemBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateSystemProfile(
        ctx.db,
        ctx.systemId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure.use(writeLimiter).mutation(async ({ ctx }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveSystem(ctx.db, ctx.systemId, ctx.auth, audit);
    return { success: true as const };
  }),

  duplicate: systemProcedure
    .use(writeLimiter)
    .input(DuplicateSystemBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return duplicateSystem(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  purge: systemProcedure
    .use(writeLimiter)
    .input(PurgeSystemBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await purgeSystem(ctx.db, ctx.systemId, input, ctx.auth, audit);
      return { success: true as const };
    }),
});
