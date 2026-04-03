import { toUnixMillis } from "@pluralscape/types";
import {
  CreateMessageBodySchema,
  UpdateMessageBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveMessage,
  createMessage,
  deleteMessage,
  getMessage,
  listMessages,
  restoreMessage,
  updateMessage,
} from "../../services/message.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

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
    .use(writeLimiter)
    .input(ChannelScopeSchema.and(CreateMessageBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createMessage(ctx.db, ctx.systemId, input.channelId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .query(async ({ ctx, input }) => {
      return getMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      ChannelScopeSchema.and(
        z.object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          includeArchived: z.boolean().default(false),
          before: z.number().int().min(0).optional(),
          after: z.number().int().min(0).optional(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listMessages(ctx.db, ctx.systemId, input.channelId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
        before: input.before !== undefined ? toUnixMillis(input.before) : undefined,
        after: input.after !== undefined ? toUnixMillis(input.after) : undefined,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
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
    .use(writeLimiter)
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(
      ChannelScopeSchema.and(MessageIdSchema).and(
        z.object({ timestamp: z.number().int().min(0).optional() }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth, audit, {
        timestamp: input.timestamp !== undefined ? toUnixMillis(input.timestamp) : undefined,
      });
      return { success: true as const };
    }),
});
