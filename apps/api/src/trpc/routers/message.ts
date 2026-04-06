import { toUnixMillis } from "@pluralscape/types";
import {
  CreateMessageBodySchema,
  UpdateMessageBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { tracked } from "@trpc/server";
import { z } from "zod/v4";

import { publishEntityChange, subscribeToEntityChanges } from "../../lib/entity-pubsub.js";
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
import { requireScope } from "../middlewares/scope.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

import type { MessageChangeEvent } from "@pluralscape/types";

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
    .use(requireScope("write:messages"))
    .input(ChannelScopeSchema.and(CreateMessageBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await createMessage(
        ctx.db,
        ctx.systemId,
        input.channelId,
        input,
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "message",
        type: "created",
        messageId: result.id,
        channelId: input.channelId,
      });
      return result;
    }),

  get: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:messages"))
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .query(async ({ ctx, input }) => {
      return getMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:messages"))
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
    .use(requireScope("write:messages"))
    .input(ChannelScopeSchema.and(MessageIdSchema).and(UpdateMessageBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await updateMessage(
        ctx.db,
        ctx.systemId,
        input.messageId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "message",
        type: "updated",
        messageId: input.messageId,
        channelId: input.channelId,
      });
      return result;
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:messages"))
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "message",
        type: "archived",
        messageId: input.messageId,
        channelId: input.channelId,
      });
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:messages"))
    .input(ChannelScopeSchema.and(MessageIdSchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await restoreMessage(ctx.db, ctx.systemId, input.messageId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "message",
        type: "updated",
        messageId: input.messageId,
        channelId: input.channelId,
      });
      return result;
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .use(requireScope("delete:messages"))
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
      void publishEntityChange(ctx.systemId, {
        entity: "message",
        type: "deleted",
        messageId: input.messageId,
        channelId: input.channelId,
      });
      return { success: true as const };
    }),

  onChange: systemProcedure
    .use(requireScope("read:messages"))
    .input(ChannelScopeSchema)
    .subscription(async function* ({ ctx, input, signal }) {
      const { channelId } = input;
      const queue: MessageChangeEvent[] = [];
      let resolve: (() => void) | null = null;

      const unsubscribe = await subscribeToEntityChanges(ctx.systemId, "message", (event) => {
        const msgEvent = event as MessageChangeEvent;
        if (msgEvent.channelId === channelId) {
          queue.push(msgEvent);
          resolve?.();
        }
      });

      try {
        while (!signal?.aborted) {
          while (queue.length > 0) {
            const event = queue.shift();
            if (event) {
              yield tracked(`${event.type}:${event.messageId}`, event);
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
