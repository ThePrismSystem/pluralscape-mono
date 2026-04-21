import {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  UpdateMemberBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveMember,
  createMember,
  deleteMember,
  duplicateMember,
  getMember,
  listAllMemberMemberships,
  listMembers,
  restoreMember,
  updateMember,
} from "../../services/member.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for member list queries. */
const MAX_LIST_LIMIT = 100;

const MemberIdSchema = z.object({
  memberId: brandedIdQueryParam("mem_"),
});

export const memberRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateMemberBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      // Service validates params internally; pass the domain fields only.
      return createMember(
        ctx.db,
        ctx.systemId,
        { encryptedData: input.encryptedData },
        ctx.auth,
        audit,
      );
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(MemberIdSchema)
    .query(async ({ ctx, input }) => {
      return getMember(ctx.db, ctx.systemId, input.memberId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        groupId: brandedIdQueryParam("grp_").optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listMembers(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        groupId: input.groupId,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(MemberIdSchema.and(UpdateMemberBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateMember(
        ctx.db,
        ctx.systemId,
        input.memberId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  duplicate: systemProcedure
    .use(writeLimiter)
    .input(MemberIdSchema.and(DuplicateMemberBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return duplicateMember(
        ctx.db,
        ctx.systemId,
        input.memberId,
        {
          encryptedData: input.encryptedData,
          copyPhotos: input.copyPhotos,
          copyFields: input.copyFields,
          copyMemberships: input.copyMemberships,
        },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(MemberIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveMember(ctx.db, ctx.systemId, input.memberId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(MemberIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreMember(ctx.db, ctx.systemId, input.memberId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(MemberIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteMember(ctx.db, ctx.systemId, input.memberId, ctx.auth, audit);
      return { success: true as const };
    }),

  listMemberships: systemProcedure
    .use(readLimiter)
    .input(MemberIdSchema)
    .query(async ({ ctx, input }) => {
      return listAllMemberMemberships(ctx.db, ctx.systemId, input.memberId, ctx.auth);
    }),
});
