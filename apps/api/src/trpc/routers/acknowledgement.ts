import {
  ConfirmAcknowledgementBodySchema,
  CreateAcknowledgementBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveAcknowledgement,
  confirmAcknowledgement,
  createAcknowledgement,
  deleteAcknowledgement,
  getAcknowledgement,
  listAcknowledgements,
  restoreAcknowledgement,
} from "../../services/acknowledgement.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for acknowledgement list queries. */
const MAX_LIST_LIMIT = 100;

const AckIdSchema = z.object({
  ackId: brandedIdQueryParam("ack_"),
});

export const acknowledgementRouter = router({
  create: systemProcedure
    .input(CreateAcknowledgementBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createAcknowledgement(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure.input(AckIdSchema).query(async ({ ctx, input }) => {
    return getAcknowledgement(ctx.db, ctx.systemId, input.ackId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
        confirmed: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listAcknowledgements(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
        confirmed: input.confirmed,
      });
    }),

  confirm: systemProcedure
    .input(AckIdSchema.and(ConfirmAcknowledgementBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return confirmAcknowledgement(
        ctx.db,
        ctx.systemId,
        input.ackId,
        { encryptedData: input.encryptedData },
        ctx.auth,
        audit,
      );
    }),

  archive: systemProcedure.input(AckIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveAcknowledgement(ctx.db, ctx.systemId, input.ackId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(AckIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreAcknowledgement(ctx.db, ctx.systemId, input.ackId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(AckIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteAcknowledgement(ctx.db, ctx.systemId, input.ackId, ctx.auth, audit);
    return { success: true as const };
  }),
});
