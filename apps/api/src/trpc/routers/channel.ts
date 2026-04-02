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
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for channel list queries. */
const MAX_LIST_LIMIT = 100;

const ChannelIdSchema = z.object({
  channelId: brandedIdQueryParam("ch_"),
});

export const channelRouter = router({
  create: systemProcedure.input(CreateChannelBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createChannel(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(ChannelIdSchema).query(async ({ ctx, input }) => {
    return getChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth);
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
      return listChannels(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  update: systemProcedure
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

  archive: systemProcedure.input(ChannelIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(ChannelIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(ChannelIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteChannel(ctx.db, ctx.systemId, input.channelId, ctx.auth, audit);
    return { success: true as const };
  }),
});
