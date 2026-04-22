import { BUCKET_CONTENT_ENTITY_TYPES } from "@pluralscape/types";
import {
  AssignBucketBodySchema,
  ClaimChunkBodySchema,
  CompleteChunkBodySchema,
  CreateBucketBodySchema,
  InitiateRotationBodySchema,
  TagContentBodySchema,
  UpdateBucketBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { archiveBucket } from "../../services/bucket/archive.js";
import { createBucket } from "../../services/bucket/create.js";
import { deleteBucket } from "../../services/bucket/delete.js";
import { getBucket } from "../../services/bucket/get.js";
import { listBuckets } from "../../services/bucket/list.js";
import { restoreBucket } from "../../services/bucket/restore.js";
import { claimRotationChunk } from "../../services/bucket/rotations/claim.js";
import { completeRotationChunk } from "../../services/bucket/rotations/complete.js";
import { initiateRotation } from "../../services/bucket/rotations/initiate.js";
import { getRotationProgress } from "../../services/bucket/rotations/queries.js";
import { retryRotation } from "../../services/bucket/rotations/retry.js";
import { updateBucket } from "../../services/bucket/update.js";
import {
  assignBucketToFriend,
  listFriendBucketAssignments,
  unassignBucketFromFriend,
} from "../../services/bucket-assignment.service.js";
import {
  listTagsByBucket,
  tagContent,
  untagContent,
} from "../../services/bucket-content-tag.service.js";
import {
  getBucketExportManifest,
  getBucketExportPage,
} from "../../services/bucket-export.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const readHeavyLimiter = createTRPCCategoryRateLimiter("readHeavy");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for bucket list queries. */
const MAX_LIST_LIMIT = 100;

const BucketIdSchema = z.object({
  bucketId: brandedIdQueryParam("bkt_"),
});

const ConnectionIdSchema = z.object({
  connectionId: brandedIdQueryParam("fc_"),
});

const RotationIdSchema = z.object({
  rotationId: brandedIdQueryParam("bkr_"),
});

export const bucketRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateBucketBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createBucket(
        ctx.db,
        ctx.systemId,
        { encryptedData: input.encryptedData },
        ctx.auth,
        audit,
      );
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(BucketIdSchema)
    .query(async ({ ctx, input }) => {
      return getBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listBuckets(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(UpdateBucketBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateBucket(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth, audit);
      return { success: true as const };
    }),

  // ── Friend assignments ──────────────────────────────────────────

  assignFriend: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(ConnectionIdSchema).and(AssignBucketBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return assignBucketToFriend(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        {
          connectionId: input.connectionId,
          encryptedBucketKey: input.encryptedBucketKey,
          keyVersion: input.keyVersion,
        },
        ctx.auth,
        audit,
      );
    }),

  unassignFriend: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(ConnectionIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return unassignBucketFromFriend(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        input.connectionId,
        ctx.auth,
        audit,
      );
    }),

  listFriendAssignments: systemProcedure
    .use(readLimiter)
    .input(BucketIdSchema)
    .query(async ({ ctx, input }) => {
      return listFriendBucketAssignments(ctx.db, ctx.systemId, input.bucketId, ctx.auth);
    }),

  // ── Content tags ────────────────────────────────────────────────────

  tagContent: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(TagContentBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return tagContent(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        { entityType: input.entityType, entityId: input.entityId },
        ctx.auth,
        audit,
      );
    }),

  untagContent: systemProcedure
    .use(writeLimiter)
    .input(
      BucketIdSchema.and(
        z.object({
          entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES),
          entityId: z.string().min(1),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await untagContent(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        input.entityType,
        input.entityId,
        ctx.auth,
        audit,
      );
      return { success: true as const };
    }),

  listTags: systemProcedure
    .use(readLimiter)
    .input(
      BucketIdSchema.and(
        z.object({
          entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES).optional(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listTagsByBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth, {
        entityType: input.entityType,
        limit: input.limit,
      });
    }),

  // ── Export ──────────────────────────────────────────────────────────

  exportManifest: systemProcedure
    .use(readHeavyLimiter)
    .input(BucketIdSchema)
    .query(async ({ ctx, input }) => {
      return getBucketExportManifest(ctx.db, ctx.systemId, input.bucketId, ctx.auth);
    }),

  exportPage: systemProcedure
    .use(readHeavyLimiter)
    .input(
      BucketIdSchema.and(
        z.object({
          entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT),
          cursor: z.string().nullish(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return getBucketExportPage(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        ctx.auth,
        input.entityType,
        input.limit,
        input.cursor ?? undefined,
      );
    }),

  // ── Key rotation ────────────────────────────────────────────────────

  initiateRotation: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(InitiateRotationBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return initiateRotation(ctx.db, ctx.systemId, input.bucketId, input, ctx.auth, audit);
    }),

  rotationProgress: systemProcedure
    .use(readLimiter)
    .input(BucketIdSchema.and(RotationIdSchema))
    .query(async ({ ctx, input }) => {
      return getRotationProgress(ctx.db, ctx.systemId, input.bucketId, input.rotationId, ctx.auth);
    }),

  claimRotationChunk: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(RotationIdSchema).and(ClaimChunkBodySchema))
    .mutation(async ({ ctx, input }) => {
      return claimRotationChunk(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        input.rotationId,
        input,
        ctx.auth,
      );
    }),

  completeRotationChunk: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(RotationIdSchema).and(CompleteChunkBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return completeRotationChunk(
        ctx.db,
        ctx.systemId,
        input.bucketId,
        input.rotationId,
        input,
        ctx.auth,
        audit,
      );
    }),

  retryRotation: systemProcedure
    .use(writeLimiter)
    .input(BucketIdSchema.and(RotationIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return retryRotation(ctx.db, ctx.systemId, input.bucketId, input.rotationId, ctx.auth, audit);
    }),
});
