import { WebhookDeliveryQuerySchema, brandedIdQueryParam } from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  deleteWebhookDelivery,
  getWebhookDelivery,
  listWebhookDeliveries,
} from "../../services/webhook-delivery.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for webhook delivery list queries. */
const MAX_LIST_LIMIT = 100;

const DeliveryIdSchema = z.object({
  deliveryId: brandedIdQueryParam("wd_"),
});

export const webhookDeliveryRouter = router({
  list: systemProcedure
    .input(
      WebhookDeliveryQuerySchema.and(
        z.object({
          cursor: z.string().optional(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        }),
      ),
    )
    .query(async ({ ctx, input }) => {
      return listWebhookDeliveries(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        webhookId: input.webhookId,
        status: input.status,
        eventType: input.eventType,
        fromDate: input.fromDate,
        toDate: input.toDate,
      });
    }),

  get: systemProcedure.input(DeliveryIdSchema).query(async ({ ctx, input }) => {
    return getWebhookDelivery(ctx.db, ctx.systemId, input.deliveryId, ctx.auth);
  }),

  delete: systemProcedure.input(DeliveryIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteWebhookDelivery(ctx.db, ctx.systemId, input.deliveryId, ctx.auth, audit);
    return { success: true as const };
  }),
});
