import {
  CreateTimerConfigBodySchema,
  UpdateTimerConfigBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveTimerConfig,
  createTimerConfig,
  deleteTimerConfig,
  getTimerConfig,
  listTimerConfigs,
  restoreTimerConfig,
  updateTimerConfig,
} from "../../services/timer-config.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for timer config list queries. */
const MAX_LIST_LIMIT = 100;

const TimerIdSchema = z.object({
  timerId: brandedIdQueryParam("tmr_"),
});

export const timerConfigRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateTimerConfigBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createTimerConfig(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(TimerIdSchema)
    .query(async ({ ctx, input }) => {
      return getTimerConfig(ctx.db, ctx.systemId, input.timerId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listTimerConfigs(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(TimerIdSchema.and(UpdateTimerConfigBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateTimerConfig(ctx.db, ctx.systemId, input.timerId, input, ctx.auth, audit);
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(TimerIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveTimerConfig(ctx.db, ctx.systemId, input.timerId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(TimerIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreTimerConfig(ctx.db, ctx.systemId, input.timerId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(TimerIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteTimerConfig(ctx.db, ctx.systemId, input.timerId, ctx.auth, audit);
      return { success: true as const };
    }),
});
