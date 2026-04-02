import {
  CreateTimerConfigBodySchema,
  UpdateTimerConfigBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveTimerConfig,
  createTimerConfig,
  getTimerConfig,
  listTimerConfigs,
  restoreTimerConfig,
  updateTimerConfig,
} from "../../services/timer-config.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for timer config list queries. */
const MAX_LIST_LIMIT = 100;

const TimerIdSchema = z.object({
  timerId: brandedIdQueryParam("tmr_"),
});

export const timerConfigRouter = router({
  create: systemProcedure.input(CreateTimerConfigBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createTimerConfig(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(TimerIdSchema).query(async ({ ctx, input }) => {
    return getTimerConfig(ctx.db, ctx.systemId, input.timerId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listTimerConfigs(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .input(TimerIdSchema.and(UpdateTimerConfigBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateTimerConfig(ctx.db, ctx.systemId, input.timerId, input, ctx.auth, audit);
    }),

  archive: systemProcedure.input(TimerIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveTimerConfig(ctx.db, ctx.systemId, input.timerId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(TimerIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreTimerConfig(ctx.db, ctx.systemId, input.timerId, ctx.auth, audit);
  }),
});
