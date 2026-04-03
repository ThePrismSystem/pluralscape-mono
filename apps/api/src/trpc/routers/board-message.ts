import {
  CreateBoardMessageBodySchema,
  ReorderBoardMessagesBodySchema,
  UpdateBoardMessageBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { tracked } from "@trpc/server";
import { z } from "zod/v4";

import { publishEntityChange, subscribeToEntityChanges } from "../../lib/entity-pubsub.js";
import {
  archiveBoardMessage,
  createBoardMessage,
  deleteBoardMessage,
  getBoardMessage,
  listBoardMessages,
  pinBoardMessage,
  reorderBoardMessages,
  restoreBoardMessage,
  unpinBoardMessage,
  updateBoardMessage,
} from "../../services/board-message.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

import type { BoardMessageChangeEvent } from "@pluralscape/types";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for board message list queries. */
const MAX_LIST_LIMIT = 100;

const BoardMessageIdSchema = z.object({
  boardMessageId: brandedIdQueryParam("bm_"),
});

export const boardMessageRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateBoardMessageBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await createBoardMessage(ctx.db, ctx.systemId, input, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "created",
        boardMessageId: result.id,
      });
      return result;
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(BoardMessageIdSchema)
    .query(async ({ ctx, input }) => {
      return getBoardMessage(ctx.db, ctx.systemId, input.boardMessageId, ctx.auth);
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
      return listBoardMessages(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .input(BoardMessageIdSchema.and(UpdateBoardMessageBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await updateBoardMessage(
        ctx.db,
        ctx.systemId,
        input.boardMessageId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "updated",
        boardMessageId: input.boardMessageId,
      });
      return result;
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(BoardMessageIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveBoardMessage(ctx.db, ctx.systemId, input.boardMessageId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "archived",
        boardMessageId: input.boardMessageId,
      });
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(BoardMessageIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await restoreBoardMessage(
        ctx.db,
        ctx.systemId,
        input.boardMessageId,
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "updated",
        boardMessageId: input.boardMessageId,
      });
      return result;
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(BoardMessageIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteBoardMessage(ctx.db, ctx.systemId, input.boardMessageId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "deleted",
        boardMessageId: input.boardMessageId,
      });
      return { success: true as const };
    }),

  reorder: systemProcedure
    .use(writeLimiter)
    .input(ReorderBoardMessagesBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await reorderBoardMessages(ctx.db, ctx.systemId, input, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "reordered",
      });
      return { success: true as const };
    }),

  pin: systemProcedure
    .use(writeLimiter)
    .input(BoardMessageIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await pinBoardMessage(
        ctx.db,
        ctx.systemId,
        input.boardMessageId,
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "pinned",
        boardMessageId: input.boardMessageId,
      });
      return result;
    }),

  unpin: systemProcedure
    .use(writeLimiter)
    .input(BoardMessageIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await unpinBoardMessage(
        ctx.db,
        ctx.systemId,
        input.boardMessageId,
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "boardMessage",
        type: "unpinned",
        boardMessageId: input.boardMessageId,
      });
      return result;
    }),

  onChange: systemProcedure.subscription(async function* ({ ctx, signal }) {
    const queue: BoardMessageChangeEvent[] = [];
    let resolve: (() => void) | null = null;

    const unsubscribe = await subscribeToEntityChanges(ctx.systemId, "boardMessage", (event) => {
      queue.push(event as BoardMessageChangeEvent);
      resolve?.();
    });

    try {
      while (!signal?.aborted) {
        while (queue.length > 0) {
          const event = queue.shift();
          if (event) {
            const id = "boardMessageId" in event ? event.boardMessageId : event.type;
            yield tracked(`${event.type}:${id}`, event);
          }
        }
        await new Promise<void>((r) => {
          resolve = r;
        });
        resolve = null;
      }
    } finally {
      await unsubscribe?.();
    }
  }),
});
