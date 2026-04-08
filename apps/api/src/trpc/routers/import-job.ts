import {
  CreateImportJobBodySchema,
  UpdateImportJobBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  createImportJob,
  getImportJob,
  listImportJobs,
  updateImportJob,
} from "../../services/import-job.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for import-job list queries. */
const MAX_LIST_LIMIT = 100;

const IMPORT_SOURCES = ["simply-plural", "pluralkit", "pluralscape"] as const;
const IMPORT_JOB_STATUSES = ["pending", "validating", "importing", "completed", "failed"] as const;

const ImportJobIdSchema = z.object({
  importJobId: brandedIdQueryParam("ij_"),
});

export const importJobRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateImportJobBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createImportJob(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(ImportJobIdSchema)
    .query(async ({ ctx, input }) => {
      return getImportJob(ctx.db, ctx.systemId, input.importJobId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        status: z.enum(IMPORT_JOB_STATUSES).optional(),
        source: z.enum(IMPORT_SOURCES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listImportJobs(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        status: input.status,
        source: input.source,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(ImportJobIdSchema.and(UpdateImportJobBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const { importJobId, ...body } = input;
      return updateImportJob(ctx.db, ctx.systemId, importJobId, body, ctx.auth, audit);
    }),
});
