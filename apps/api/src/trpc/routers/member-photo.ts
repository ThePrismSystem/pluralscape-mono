import {
  CreateMemberPhotoBodySchema,
  ReorderPhotosBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { fromCompositeCursor } from "../../lib/pagination.js";
import { createMemberPhoto } from "../../services/member/photos/create.js";
import {
  archiveMemberPhoto,
  deleteMemberPhoto,
  restoreMemberPhoto,
} from "../../services/member/photos/lifecycle.js";
import { getMemberPhoto, listMemberPhotos } from "../../services/member/photos/queries.js";
import { reorderMemberPhotos } from "../../services/member/photos/update.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for member photo list queries. */
const MAX_LIST_LIMIT = 50;

const MemberIdSchema = z.object({
  memberId: brandedIdQueryParam("mem_"),
});

const PhotoIdSchema = z.object({
  photoId: brandedIdQueryParam("mp_"),
});

const MemberPhotoIdSchema = MemberIdSchema.and(PhotoIdSchema);

export const memberPhotoRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(MemberIdSchema.and(CreateMemberPhotoBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createMemberPhoto(
        ctx.db,
        ctx.systemId,
        input.memberId,
        { encryptedData: input.encryptedData, sortOrder: input.sortOrder },
        ctx.auth,
        audit,
      );
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(MemberPhotoIdSchema)
    .query(async ({ ctx, input }) => {
      return getMemberPhoto(ctx.db, ctx.systemId, input.memberId, input.photoId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      MemberIdSchema.and(
        z.object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      const cursor = input.cursor ? fromCompositeCursor(input.cursor, "member photo") : undefined;
      return listMemberPhotos(ctx.db, ctx.systemId, input.memberId, ctx.auth, {
        cursor,
        limit: input.limit,
      });
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(MemberPhotoIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveMemberPhoto(
        ctx.db,
        ctx.systemId,
        input.memberId,
        input.photoId,
        ctx.auth,
        audit,
      );
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(MemberPhotoIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreMemberPhoto(
        ctx.db,
        ctx.systemId,
        input.memberId,
        input.photoId,
        ctx.auth,
        audit,
      );
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(MemberPhotoIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteMemberPhoto(ctx.db, ctx.systemId, input.memberId, input.photoId, ctx.auth, audit);
      return { success: true as const };
    }),

  reorder: systemProcedure
    .use(writeLimiter)
    .input(MemberIdSchema.and(ReorderPhotosBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return reorderMemberPhotos(
        ctx.db,
        ctx.systemId,
        input.memberId,
        { order: input.order },
        ctx.auth,
        audit,
      );
    }),
});
