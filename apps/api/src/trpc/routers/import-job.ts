import { IMPORT_JOB_STATUSES, IMPORT_SOURCES } from "@pluralscape/types";
import {
  CreateImportJobBodySchema,
  UpdateImportJobBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { MAX_PAGE_LIMIT } from "../../service.constants.js";
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
        limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
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
