import {
  CreateMemberPhotoBodySchema,
  ReorderPhotosBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { fromCompositeCursor } from "../../lib/pagination.js";
import {
  archiveMemberPhoto,
  createMemberPhoto,
  deleteMemberPhoto,
  getMemberPhoto,
  listMemberPhotos,
  reorderMemberPhotos,
  restoreMemberPhoto,
} from "../../services/member-photo.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

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

  get: systemProcedure.input(MemberPhotoIdSchema).query(async ({ ctx, input }) => {
    return getMemberPhoto(ctx.db, ctx.systemId, input.memberId, input.photoId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      MemberIdSchema.and(
        z.object({
          cursor: z.string().optional(),
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

  archive: systemProcedure.input(MemberPhotoIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveMemberPhoto(ctx.db, ctx.systemId, input.memberId, input.photoId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(MemberPhotoIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreMemberPhoto(ctx.db, ctx.systemId, input.memberId, input.photoId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(MemberPhotoIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteMemberPhoto(ctx.db, ctx.systemId, input.memberId, input.photoId, ctx.auth, audit);
    return { success: true as const };
  }),

  reorder: systemProcedure
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
