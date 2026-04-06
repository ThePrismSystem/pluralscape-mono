import {
  CreateChannelBodySchema,
  UpdateChannelBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveChannel,
  createChannel,
  deleteChannel,
  getChannel,
  listChannels,
  restoreChannel,
  updateChannel,
} from "../../services/channel.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { requireScope } from "../middlewares/scope.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for channel list queries. */
const MAX_LIST_LIMIT = 100;

const ChannelIdSchema = z.object({
  channelId: brandedIdQueryParam("ch_"),
});

export const channelRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:channels"))
    .input(CreateChannelBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createChannel(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:channels"))
    .input(ChannelIdSchema)
    .query(async ({ ctx, input }) => {
      return getChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:channels"))
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listChannels(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:channels"))
    .input(ChannelIdSchema.and(UpdateChannelBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateChannel(
        ctx.db,
        ctx.systemId,
        input.channelId,
        { encryptedData: input.encryptedData, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:channels"))
    .input(ChannelIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:channels"))
    .input(ChannelIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .use(requireScope("delete:channels"))
    .input(ChannelIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
      return { success: true as const };
    }),
});
