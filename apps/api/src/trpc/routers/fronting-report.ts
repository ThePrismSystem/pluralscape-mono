import {
  CreateFrontingReportBodySchema,
  UpdateFrontingReportBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { createFrontingReport } from "../../services/fronting-report/create.js";
import { deleteFrontingReport } from "../../services/fronting-report/delete.js";
import {
  archiveFrontingReport,
  restoreFrontingReport,
} from "../../services/fronting-report/lifecycle.js";
import {
  getFrontingReport,
  listFrontingReports,
} from "../../services/fronting-report/queries.js";
import { updateFrontingReport } from "../../services/fronting-report/update.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for fronting report list queries. */
const MAX_LIST_LIMIT = 100;

const ReportIdSchema = z.object({
  reportId: brandedIdQueryParam("fr_"),
});

export const frontingReportRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateFrontingReportBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createFrontingReport(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(ReportIdSchema)
    .query(async ({ ctx, input }) => {
      return getFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth);
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
      return listFrontingReports(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(ReportIdSchema.and(UpdateFrontingReportBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateFrontingReport(ctx.db, ctx.systemId, input.reportId, input, ctx.auth, audit);
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(ReportIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(ReportIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(ReportIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
      return { success: true as const };
    }),
});
