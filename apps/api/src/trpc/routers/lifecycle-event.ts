import {
  CreateLifecycleEventBodySchema,
  UpdateLifecycleEventBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { createLifecycleEvent } from "../../services/lifecycle-event/create.js";
import { deleteLifecycleEvent } from "../../services/lifecycle-event/delete.js";
import {
  archiveLifecycleEvent,
  restoreLifecycleEvent,
} from "../../services/lifecycle-event/lifecycle.js";
import {
  getLifecycleEvent,
  listLifecycleEvents,
} from "../../services/lifecycle-event/queries.js";
import { updateLifecycleEvent } from "../../services/lifecycle-event/update.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for lifecycle event list queries. */
const MAX_LIST_LIMIT = 100;

const EventIdSchema = z.object({
  eventId: brandedIdQueryParam("evt_"),
});

export const lifecycleEventRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateLifecycleEventBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createLifecycleEvent(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(EventIdSchema)
    .query(async ({ ctx, input }) => {
      return getLifecycleEvent(ctx.db, ctx.systemId, input.eventId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        eventType: z.string().optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listLifecycleEvents(
        ctx.db,
        ctx.systemId,
        ctx.auth,
        input.cursor ?? undefined,
        input.limit,
        input.eventType,
        input.includeArchived,
      );
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(EventIdSchema.and(UpdateLifecycleEventBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateLifecycleEvent(ctx.db, ctx.systemId, input.eventId, input, ctx.auth, audit);
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(EventIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveLifecycleEvent(ctx.db, ctx.systemId, input.eventId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(EventIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreLifecycleEvent(ctx.db, ctx.systemId, input.eventId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(EventIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteLifecycleEvent(ctx.db, ctx.systemId, input.eventId, ctx.auth, audit);
      return { success: true as const };
    }),
});
