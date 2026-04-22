import {
  CreateChannelBodySchema,
  UpdateChannelBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { createChannel } from "../../services/channel/create.js";
import { deleteChannel } from "../../services/channel/delete.js";
import { archiveChannel, restoreChannel } from "../../services/channel/lifecycle.js";
import { getChannel, listChannels } from "../../services/channel/queries.js";
import { updateChannel } from "../../services/channel/update.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
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
    .input(CreateChannelBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createChannel(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(ChannelIdSchema)
    .query(async ({ ctx, input }) => {
      return getChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth);
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
      return listChannels(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
    .use(writeLimiter)
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
    .input(ChannelIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(ChannelIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(ChannelIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
      return { success: true as const };
    }),
});
