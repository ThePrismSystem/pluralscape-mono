import {
  ConfirmUploadBodySchema,
  CreateUploadUrlBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { getQuotaService, getStorageAdapter } from "../../lib/storage.js";
import {
  archiveBlob,
  confirmUpload,
  createUploadUrl,
  getBlob,
  getDownloadUrl,
  listBlobs,
} from "../../services/blob.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for blob list queries. */
const MAX_LIST_LIMIT = 100;

const BlobIdSchema = z.object({
  blobId: brandedIdQueryParam("blob_"),
});

export const blobRouter = router({
  createUploadUrl: systemProcedure
    .input(CreateUploadUrlBodySchema)
    .mutation(async ({ ctx, input }) => {
      const storageAdapter = getStorageAdapter();
      const quotaService = getQuotaService(ctx.db);
      const audit = ctx.createAudit(ctx.auth);
      return createUploadUrl(
        ctx.db,
        storageAdapter,
        quotaService,
        ctx.systemId,
        input,
        ctx.auth,
        audit,
      );
    }),

  confirmUpload: systemProcedure
    .input(BlobIdSchema.and(ConfirmUploadBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return confirmUpload(ctx.db, ctx.systemId, input.blobId, input, ctx.auth, audit);
    }),

  get: systemProcedure.input(BlobIdSchema).query(async ({ ctx, input }) => {
    return getBlob(ctx.db, ctx.systemId, input.blobId, ctx.auth);
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
      return listBlobs(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  getDownloadUrl: systemProcedure.input(BlobIdSchema).query(async ({ ctx, input }) => {
    const storageAdapter = getStorageAdapter();
    return getDownloadUrl(ctx.db, storageAdapter, ctx.systemId, input.blobId, ctx.auth);
  }),

  delete: systemProcedure.input(BlobIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveBlob(ctx.db, ctx.systemId, input.blobId, ctx.auth, audit);
    return { success: true as const };
  }),
});
