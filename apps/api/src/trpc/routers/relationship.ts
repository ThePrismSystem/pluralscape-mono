import {
  CreateRelationshipBodySchema,
  UpdateRelationshipBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  archiveRelationship,
  createRelationship,
  deleteRelationship,
  getRelationship,
  listRelationships,
  restoreRelationship,
  updateRelationship,
} from "../../services/relationship.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for relationship list queries. */
const MAX_LIST_LIMIT = 100;

const RelationshipIdSchema = z.object({
  relationshipId: brandedIdQueryParam("rel_"),
});

export const relationshipRouter = router({
  create: systemProcedure.input(CreateRelationshipBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createRelationship(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(RelationshipIdSchema).query(async ({ ctx, input }) => {
    return getRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        memberId: z.string().optional(),
        type: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listRelationships(
        ctx.db,
        ctx.systemId,
        ctx.auth,
        input.cursor,
        input.limit,
        input.memberId,
        input.type,
      );
    }),

  update: systemProcedure
    .input(RelationshipIdSchema.and(UpdateRelationshipBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateRelationship(ctx.db, ctx.systemId, input.relationshipId, input, ctx.auth, audit);
    }),

  archive: systemProcedure.input(RelationshipIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth, audit);
    return { success: true as const };
  }),

  restore: systemProcedure.input(RelationshipIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth, audit);
  }),

  delete: systemProcedure.input(RelationshipIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth, audit);
    return { success: true as const };
  }),
});
