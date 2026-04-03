import {
  CreateRelationshipBodySchema,
  RELATIONSHIP_TYPES,
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
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for relationship list queries. */
const MAX_LIST_LIMIT = 100;

const RelationshipIdSchema = z.object({
  relationshipId: brandedIdQueryParam("rel_"),
});

export const relationshipRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .input(CreateRelationshipBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createRelationship(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .input(RelationshipIdSchema)
    .query(async ({ ctx, input }) => {
      return getRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        memberId: z.string().optional(),
        type: z.enum(RELATIONSHIP_TYPES).optional(),
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
    .use(writeLimiter)
    .input(RelationshipIdSchema.and(UpdateRelationshipBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateRelationship(ctx.db, ctx.systemId, input.relationshipId, input, ctx.auth, audit);
    }),

  archive: systemProcedure
    .use(writeLimiter)
    .input(RelationshipIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth, audit);
      return { success: true as const };
    }),

  restore: systemProcedure
    .use(writeLimiter)
    .input(RelationshipIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth, audit);
    }),

  delete: systemProcedure
    .use(writeLimiter)
    .input(RelationshipIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteRelationship(ctx.db, ctx.systemId, input.relationshipId, ctx.auth, audit);
      return { success: true as const };
    }),
});
