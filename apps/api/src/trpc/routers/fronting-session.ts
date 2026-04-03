import {
  CreateFrontingSessionBodySchema,
  EndFrontingSessionBodySchema,
  UpdateFrontingSessionBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveFrontingSession,
  createFrontingSession,
  deleteFrontingSession,
  endFrontingSession,
  getActiveFronting,
  getFrontingSession,
  listFrontingSessions,
  restoreFrontingSession,
  updateFrontingSession,
} from "../../services/fronting-session.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for fronting session list queries. */
const MAX_LIST_LIMIT = 100;

const SessionIdSchema = z.object({
  sessionId: brandedIdQueryParam("fs_"),
});

export const frontingSessionRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateFrontingSessionBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createFrontingSession(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(SessionIdSchema)
    .query(async ({ ctx, input }) => {
      return getFrontingSession(ctx.db, ctx.systemId, input.sessionId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        memberId: brandedIdQueryParam("mem_").optional(),
        customFrontId: brandedIdQueryParam("cf_").optional(),
        structureEntityId: brandedIdQueryParam("ste_").optional(),
        startFrom: z.number().int().min(0).optional(),
        startUntil: z.number().int().min(0).optional(),
        endFrom: z.number().int().min(0).optional(),
        endUntil: z.number().int().min(0).optional(),
        activeOnly: z.boolean().default(false),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listFrontingSessions(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        memberId: input.memberId,
        customFrontId: input.customFrontId,
        structureEntityId: input.structureEntityId,
        startFrom: input.startFrom,
        startUntil: input.startUntil,
        endFrom: input.endFrom,
        endUntil: input.endUntil,
        activeOnly: input.activeOnly,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(SessionIdSchema.and(UpdateFrontingSessionBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateFrontingSession(
        ctx.db,
        ctx.systemId,
        input.sessionId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  end: systemProcedure
    .use(writeLimiter)
    .input(SessionIdSchema.and(EndFrontingSessionBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return endFrontingSession(
        ctx.db,
        ctx.systemId,
        input.sessionId,
        { endTime: input.endTime, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(SessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveFrontingSession(ctx.db, ctx.systemId, input.sessionId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(SessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreFrontingSession(ctx.db, ctx.systemId, input.sessionId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(SessionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteFrontingSession(ctx.db, ctx.systemId, input.sessionId, ctx.auth, audit);
      return { success: true as const };
    }),

  getActive: systemProcedure.use(readLimiter).query(async ({ ctx }) => {
    return getActiveFronting(ctx.db, ctx.systemId, ctx.auth);
  }),
});
