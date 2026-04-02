import {
  CreateFrontingReportBodySchema,
  UpdateFrontingReportBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveFrontingReport,
  createFrontingReport,
  getFrontingReport,
  listFrontingReports,
  restoreFrontingReport,
  updateFrontingReport,
} from "../../services/fronting-report.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for fronting report list queries. */
const MAX_LIST_LIMIT = 100;

const ReportIdSchema = z.object({
  reportId: brandedIdQueryParam("fr_"),
});

export const frontingReportRouter = router({
  create: systemProcedure.input(CreateFrontingReportBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createFrontingReport(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(ReportIdSchema).query(async ({ ctx, input }) => {
    return getFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listFrontingReports(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
      });
    }),

  update: systemProcedure
    .input(ReportIdSchema.and(UpdateFrontingReportBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateFrontingReport(ctx.db, ctx.systemId, input.reportId, input, ctx.auth, audit);
    }),

  archive: systemProcedure.input(ReportIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(ReportIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
  }),
});
