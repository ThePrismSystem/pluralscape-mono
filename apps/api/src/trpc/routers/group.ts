import {
  CopyGroupBodySchema,
  CreateGroupBodySchema,
  MoveGroupBodySchema,
  ReorderGroupsBodySchema,
  UpdateGroupBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  addMember,
  listGroupMembers,
  removeMember,
} from "../../services/group-membership.service.js";
import {
  archiveGroup,
  copyGroup,
  createGroup,
  deleteGroup,
  getGroup,
  getGroupTree,
  listGroups,
  moveGroup,
  reorderGroups,
  restoreGroup,
  updateGroup,
} from "../../services/group.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for group list queries. */
const MAX_LIST_LIMIT = 100;

const GroupIdSchema = z.object({
  groupId: brandedIdQueryParam("grp_"),
});

const MemberIdSchema = z.object({
  memberId: brandedIdQueryParam("mem_"),
});

export const groupRouter = router({
  create: systemProcedure.input(CreateGroupBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createGroup(
      ctx.db,
      ctx.systemId,
      {
        encryptedData: input.encryptedData,
        parentGroupId: input.parentGroupId,
        sortOrder: input.sortOrder,
      },
      ctx.auth,
      audit,
    );
  }),

  get: systemProcedure.input(GroupIdSchema).query(async ({ ctx, input }) => {
    return getGroup(ctx.db, ctx.systemId, input.groupId, ctx.auth);
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
      return listGroups(
        ctx.db,
        ctx.systemId,
        ctx.auth,
        input.cursor,
        input.limit,
        input.includeArchived,
      );
    }),

  update: systemProcedure
    .input(GroupIdSchema.and(UpdateGroupBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateGroup(
        ctx.db,
        ctx.systemId,
        input.groupId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  delete: systemProcedure.input(GroupIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteGroup(ctx.db, ctx.systemId, input.groupId, ctx.auth, audit);
    return { success: true as const };
  }),

  archive: systemProcedure.input(GroupIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveGroup(ctx.db, ctx.systemId, input.groupId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(GroupIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreGroup(ctx.db, ctx.systemId, input.groupId, ctx.auth, audit);
  }),

  move: systemProcedure
    .input(GroupIdSchema.and(MoveGroupBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return moveGroup(
        ctx.db,
        ctx.systemId,
        input.groupId,
        { targetParentGroupId: input.targetParentGroupId, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  copy: systemProcedure
    .input(GroupIdSchema.and(CopyGroupBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return copyGroup(
        ctx.db,
        ctx.systemId,
        input.groupId,
        {
          targetParentGroupId: input.targetParentGroupId,
          copyMemberships: input.copyMemberships,
        },
        ctx.auth,
        audit,
      );
    }),

  getTree: systemProcedure.query(async ({ ctx }) => {
    return getGroupTree(ctx.db, ctx.systemId, ctx.auth);
  }),

  reorder: systemProcedure.input(ReorderGroupsBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await reorderGroups(ctx.db, ctx.systemId, { operations: input.operations }, ctx.auth, audit);
    return { success: true as const };
  }),

  addMember: systemProcedure
    .input(GroupIdSchema.and(MemberIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return addMember(
        ctx.db,
        ctx.systemId,
        input.groupId,
        { memberId: input.memberId },
        ctx.auth,
        audit,
      );
    }),

  removeMember: systemProcedure
    .input(GroupIdSchema.and(MemberIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await removeMember(ctx.db, ctx.systemId, input.groupId, input.memberId, ctx.auth, audit);
      return { success: true as const };
    }),

  listMembers: systemProcedure
    .input(
      GroupIdSchema.and(
        z.object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listGroupMembers(
        ctx.db,
        ctx.systemId,
        input.groupId,
        ctx.auth,
        input.cursor,
        input.limit,
      );
    }),
});
