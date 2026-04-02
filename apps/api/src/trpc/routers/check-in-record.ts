import {
  CreateCheckInRecordBodySchema,
  RespondCheckInRecordBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveCheckInRecord,
  createCheckInRecord,
  deleteCheckInRecord,
  dismissCheckInRecord,
  getCheckInRecord,
  listCheckInRecords,
  respondCheckInRecord,
  restoreCheckInRecord,
} from "../../services/check-in-record.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for check-in record list queries. */
const MAX_LIST_LIMIT = 100;

const RecordIdSchema = z.object({
  recordId: brandedIdQueryParam("cir_"),
});

export const checkInRecordRouter = router({
  create: systemProcedure.input(CreateCheckInRecordBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createCheckInRecord(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(RecordIdSchema).query(async ({ ctx, input }) => {
    return getCheckInRecord(ctx.db, ctx.systemId, input.recordId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        timerConfigId: brandedIdQueryParam("tmr_").optional(),
        pending: z.boolean().optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listCheckInRecords(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        timerConfigId: input.timerConfigId,
        pending: input.pending,
        includeArchived: input.includeArchived,
      });
    }),

  respond: systemProcedure
    .input(RecordIdSchema.and(RespondCheckInRecordBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return respondCheckInRecord(ctx.db, ctx.systemId, input.recordId, input, ctx.auth, audit);
    }),

  dismiss: systemProcedure.input(RecordIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return dismissCheckInRecord(ctx.db, ctx.systemId, input.recordId, ctx.auth, audit);
  }),

  archive: systemProcedure.input(RecordIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveCheckInRecord(ctx.db, ctx.systemId, input.recordId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(RecordIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreCheckInRecord(ctx.db, ctx.systemId, input.recordId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(RecordIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteCheckInRecord(ctx.db, ctx.systemId, input.recordId, ctx.auth, audit);
    return { success: true as const };
  }),
});
