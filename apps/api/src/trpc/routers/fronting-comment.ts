import {
  CreateFrontingCommentBodySchema,
  UpdateFrontingCommentBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveFrontingComment,
  createFrontingComment,
  getFrontingComment,
  listFrontingComments,
  restoreFrontingComment,
  updateFrontingComment,
} from "../../services/fronting-comment.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for fronting comment list queries. */
const MAX_LIST_LIMIT = 100;

const SessionIdSchema = z.object({
  sessionId: brandedIdQueryParam("fs_"),
});

const CommentIdSchema = z.object({
  commentId: brandedIdQueryParam("fcom_"),
});

export const frontingCommentRouter = router({
  create: systemProcedure
    .input(SessionIdSchema.and(CreateFrontingCommentBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createFrontingComment(ctx.db, ctx.systemId, input.sessionId, input, ctx.auth, audit);
    }),

  get: systemProcedure.input(SessionIdSchema.and(CommentIdSchema)).query(async ({ ctx, input }) => {
    return getFrontingComment(ctx.db, ctx.systemId, input.sessionId, input.commentId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      SessionIdSchema.and(
        z.object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          includeArchived: z.boolean().default(false),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listFrontingComments(ctx.db, ctx.systemId, input.sessionId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .input(SessionIdSchema.and(CommentIdSchema).and(UpdateFrontingCommentBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateFrontingComment(
        ctx.db,
        ctx.systemId,
        input.sessionId,
        input.commentId,
        input,
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure
    .input(SessionIdSchema.and(CommentIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveFrontingComment(
        ctx.db,
        ctx.systemId,
        input.sessionId,
        input.commentId,
        ctx.auth,
        audit,
      );
      return { success: true as const };
    }),

  restore: systemProcedure
    .input(SessionIdSchema.and(CommentIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreFrontingComment(
        ctx.db,
        ctx.systemId,
        input.sessionId,
        input.commentId,
        ctx.auth,
        audit,
      );
    }),
});
