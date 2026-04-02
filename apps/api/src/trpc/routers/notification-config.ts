import { NOTIFICATION_EVENT_TYPES } from "@pluralscape/db";
import { UpdateNotificationConfigBodySchema } from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  getOrCreateNotificationConfig,
  listNotificationConfigs,
  updateNotificationConfig,
} from "../../services/notification-config.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const [firstEventType, ...restEventTypes] = NOTIFICATION_EVENT_TYPES;

const EventTypeSchema = z.object({
  eventType: z.enum([firstEventType, ...restEventTypes]),
});

export const notificationConfigRouter = router({
  get: systemProcedure.input(EventTypeSchema).query(async ({ ctx, input }) => {
    return getOrCreateNotificationConfig(ctx.db, ctx.systemId, input.eventType, ctx.auth);
  }),

  update: systemProcedure
    .input(EventTypeSchema.and(UpdateNotificationConfigBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateNotificationConfig(
        ctx.db,
        ctx.systemId,
        input.eventType,
        input,
        ctx.auth,
        audit,
      );
    }),

  list: systemProcedure.query(async ({ ctx }) => {
    return listNotificationConfigs(ctx.db, ctx.systemId, ctx.auth);
  }),
});
