import {
  CreateWebhookConfigBodySchema,
  RotateWebhookSecretBodySchema,
  UpdateWebhookConfigBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveWebhookConfig,
  createWebhookConfig,
  deleteWebhookConfig,
  getWebhookConfig,
  listWebhookConfigs,
  restoreWebhookConfig,
  rotateWebhookSecret,
  testWebhookConfig,
  updateWebhookConfig,
} from "../../services/webhook-config.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for webhook config list queries. */
const MAX_LIST_LIMIT = 100;

const WebhookIdSchema = z.object({
  webhookId: brandedIdQueryParam("wh_"),
});

export const webhookConfigRouter = router({
  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listWebhookConfigs(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  get: systemProcedure.input(WebhookIdSchema).query(async ({ ctx, input }) => {
    return getWebhookConfig(ctx.db, ctx.systemId, input.webhookId, ctx.auth);
  }),

  create: systemProcedure.input(CreateWebhookConfigBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createWebhookConfig(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  update: systemProcedure
    .input(WebhookIdSchema.and(UpdateWebhookConfigBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const { webhookId, ...body } = input;
      return updateWebhookConfig(ctx.db, ctx.systemId, webhookId, body, ctx.auth, audit);
    }),

  delete: systemProcedure.input(WebhookIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteWebhookConfig(ctx.db, ctx.systemId, input.webhookId, ctx.auth, audit);
    return { success: true as const };
  }),

  archive: systemProcedure.input(WebhookIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveWebhookConfig(ctx.db, ctx.systemId, input.webhookId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(WebhookIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreWebhookConfig(ctx.db, ctx.systemId, input.webhookId, ctx.auth, audit);
  }),

  rotateSecret: systemProcedure
    .input(WebhookIdSchema.and(RotateWebhookSecretBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const { webhookId, ...body } = input;
      return rotateWebhookSecret(ctx.db, ctx.systemId, webhookId, body, ctx.auth, audit);
    }),

  test: systemProcedure.input(WebhookIdSchema).mutation(async ({ ctx, input }) => {
    return testWebhookConfig(ctx.db, ctx.systemId, input.webhookId, ctx.auth);
  }),
});
