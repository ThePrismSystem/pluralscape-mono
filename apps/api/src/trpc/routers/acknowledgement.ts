import {
  ConfirmAcknowledgementBodySchema,
  CreateAcknowledgementBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { tracked } from "@trpc/server";
import { z } from "zod/v4";

import { publishEntityChange, subscribeToEntityChanges } from "../../lib/entity-pubsub.js";
import {
  archiveAcknowledgement,
  confirmAcknowledgement,
  createAcknowledgement,
  deleteAcknowledgement,
  getAcknowledgement,
  listAcknowledgements,
  restoreAcknowledgement,
} from "../../services/acknowledgement.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { requireScope } from "../middlewares/scope.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

import type { AcknowledgementChangeEvent } from "@pluralscape/types";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for acknowledgement list queries. */
const MAX_LIST_LIMIT = 100;

const AckIdSchema = z.object({
  ackId: brandedIdQueryParam("ack_"),
});

export const acknowledgementRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:acknowledgements"))
    .input(CreateAcknowledgementBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await createAcknowledgement(ctx.db, ctx.systemId, input, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "acknowledgement",
        type: "created",
        ackId: result.id,
      });
      return result;
    }),

  get: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:acknowledgements"))
    .input(AckIdSchema)
    .query(async ({ ctx, input }) => {
      return getAcknowledgement(ctx.db, ctx.systemId, input.ackId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .use(requireScope("read:acknowledgements"))
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
        confirmed: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listAcknowledgements(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeArchived: input.includeArchived,
        confirmed: input.confirmed,
      });
    }),

  confirm: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:acknowledgements"))
    .input(AckIdSchema.and(ConfirmAcknowledgementBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await confirmAcknowledgement(
        ctx.db,
        ctx.systemId,
        input.ackId,
        { encryptedData: input.encryptedData },
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "acknowledgement",
        type: "confirmed",
        ackId: input.ackId,
      });
      return result;
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:acknowledgements"))
    .input(AckIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveAcknowledgement(ctx.db, ctx.systemId, input.ackId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "acknowledgement",
        type: "archived",
        ackId: input.ackId,
      });
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .use(requireScope("write:acknowledgements"))
    .input(AckIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      const result = await restoreAcknowledgement(
        ctx.db,
        ctx.systemId,
        input.ackId,
        ctx.auth,
        audit,
      );
      void publishEntityChange(ctx.systemId, {
        entity: "acknowledgement",
        type: "updated",
        ackId: input.ackId,
      });
      return result;
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .use(requireScope("delete:acknowledgements"))
    .input(AckIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteAcknowledgement(ctx.db, ctx.systemId, input.ackId, ctx.auth, audit);
      void publishEntityChange(ctx.systemId, {
        entity: "acknowledgement",
        type: "deleted",
        ackId: input.ackId,
      });
      return { success: true as const };
    }),

  onChange: systemProcedure
    .use(requireScope("read:acknowledgements"))
    .subscription(async function* ({ ctx, signal }) {
      const queue: AcknowledgementChangeEvent[] = [];
      let resolve: (() => void) | null = null;

      const unsubscribe = await subscribeToEntityChanges(
        ctx.systemId,
        "acknowledgement",
        (event) => {
          queue.push(event as AcknowledgementChangeEvent);
          resolve?.();
        },
      );

      try {
        while (!signal?.aborted) {
          while (queue.length > 0) {
            const event = queue.shift();
            if (event) {
              yield tracked(`${event.type}:${event.ackId}`, event);
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
