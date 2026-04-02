import {
  CreateMessageBodySchema,
  UpdateMessageBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveMessage,
  createMessage,
  getMessage,
  listMessages,
  restoreMessage,
  updateMessage,
} from "../../services/message.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for message list queries. */
const MAX_LIST_LIMIT = 100;

const ChannelScopeSchema = z.object({
  channelId: brandedIdQueryParam("ch_"),
});

const MessageIdSchema = z.object({
  messageId: brandedIdQueryParam("msg_"),
});

export const messageRouter = router({
  create: systemProcedure
    .input(ChannelScopeSchema.and(CreateMessageBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createMessage(ctx.db, ctx.systemId, input.channelId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .query(async ({ ctx, input }) => {
      return getMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth);
    }),

  list: systemProcedure
    .input(
      ChannelScopeSchema.and(
        z.object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          includeArchived: z.boolean().default(false),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listMessages(ctx.db, ctx.systemId, input.channelId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .input(ChannelScopeSchema.and(MessageIdSchema).and(UpdateMessageBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateMessage(
        ctx.db,
        ctx.systemId,
        input.messageId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth, audit);
    }),
});
