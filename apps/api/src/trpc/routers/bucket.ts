import { BUCKET_CONTENT_ENTITY_TYPES } from "@pluralscape/types";
import {
  AssignBucketBodySchema,
  CreateBucketBodySchema,
  TagContentBodySchema,
  UpdateBucketBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

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
import {
  archiveBucket,
  createBucket,
  deleteBucket,
  getBucket,
  listBuckets,
  restoreBucket,
  updateBucket,
} from "../../services/bucket.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for bucket list queries. */
const MAX_LIST_LIMIT = 100;

const BucketIdSchema = z.object({
  bucketId: brandedIdQueryParam("bkt_"),
});

const ConnectionIdSchema = z.object({
  connectionId: brandedIdQueryParam("fc_"),
});

export const bucketRouter = router({
  create: systemProcedure.input(CreateBucketBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createBucket(
      ctx.db,
      ctx.systemId,
      { encryptedData: input.encryptedData },
      ctx.auth,
      audit,
    );
  }),

  get: systemProcedure.input(BucketIdSchema).query(async ({ ctx, input }) => {
    return getBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth);
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
      return listBuckets(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
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

  archive: systemProcedure.input(BucketIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(BucketIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(BucketIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteBucket(ctx.db, ctx.systemId, input.bucketId, ctx.auth, audit);
    return { success: true as const };
  }),

  // ── Friend assignments ──────────────────────────────────────────────

  assignFriend: systemProcedure
    .input(BucketIdSchema.and(AssignBucketBodySchema))
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

  listFriendAssignments: systemProcedure.input(BucketIdSchema).query(async ({ ctx, input }) => {
    return listFriendBucketAssignments(ctx.db, ctx.systemId, input.bucketId, ctx.auth);
  }),

  // ── Content tags ────────────────────────────────────────────────────

  tagContent: systemProcedure
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

  exportManifest: systemProcedure.input(BucketIdSchema).query(async ({ ctx, input }) => {
    return getBucketExportManifest(ctx.db, ctx.systemId, input.bucketId, ctx.auth);
  }),

  exportPage: systemProcedure
    .input(
      BucketIdSchema.and(
        z.object({
          entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT),
          cursor: z.string().optional(),
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
        input.cursor,
      );
    }),
});
