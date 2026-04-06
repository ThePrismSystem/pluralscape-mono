import {
  CreateFrontingReportBodySchema,
  UpdateFrontingReportBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveFrontingReport,
  createFrontingReport,
  deleteFrontingReport,
  getFrontingReport,
  listFrontingReports,
  restoreFrontingReport,
  updateFrontingReport,
} from "../../services/fronting-report.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { requireScope } from "../middlewares/scope.js";
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
    .use(requireScope("write:reports"))
    .input(CreateFrontingReportBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createFrontingReport(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:reports"))
    .input(ReportIdSchema)
    .query(async ({ ctx, input }) => {
      return getFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:reports"))
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
    .use(requireScope("write:reports"))
    .input(ReportIdSchema.and(UpdateFrontingReportBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateFrontingReport(ctx.db, ctx.systemId, input.reportId, input, ctx.auth, audit);
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:reports"))
    .input(ReportIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:reports"))
    .input(ReportIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .use(requireScope("delete:reports"))
    .input(ReportIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteFrontingReport(ctx.db, ctx.systemId, input.reportId, ctx.auth, audit);
      return { success: true as const };
    }),
});
