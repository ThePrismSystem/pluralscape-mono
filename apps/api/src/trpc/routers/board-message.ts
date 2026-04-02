import {
  CreateBoardMessageBodySchema,
  ReorderBoardMessagesBodySchema,
  UpdateBoardMessageBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveBoardMessage,
  createBoardMessage,
  deleteBoardMessage,
  getBoardMessage,
  listBoardMessages,
  reorderBoardMessages,
  restoreBoardMessage,
  updateBoardMessage,
} from "../../services/board-message.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for board message list queries. */
const MAX_LIST_LIMIT = 100;

const BoardMessageIdSchema = z.object({
  boardMessageId: brandedIdQueryParam("bm_"),
});

export const boardMessageRouter = router({
  create: systemProcedure.input(CreateBoardMessageBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createBoardMessage(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(BoardMessageIdSchema).query(async ({ ctx, input }) => {
    return getBoardMessage(ctx.db, ctx.systemId, input.boardMessageId, ctx.auth);
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
      return listBoardMessages(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .input(BoardMessageIdSchema.and(UpdateBoardMessageBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateBoardMessage(
        ctx.db,
        ctx.systemId,
        input.boardMessageId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure.input(BoardMessageIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveBoardMessage(ctx.db, ctx.systemId, input.boardMessageId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(BoardMessageIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreBoardMessage(ctx.db, ctx.systemId, input.boardMessageId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(BoardMessageIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteBoardMessage(ctx.db, ctx.systemId, input.boardMessageId, ctx.auth, audit);
    return { success: true as const };
  }),

  reorder: systemProcedure
    .input(ReorderBoardMessagesBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await reorderBoardMessages(ctx.db, ctx.systemId, input, ctx.auth, audit);
      return { success: true as const };
    }),
});
