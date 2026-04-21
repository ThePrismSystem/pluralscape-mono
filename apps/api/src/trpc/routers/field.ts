import {
  CreateFieldDefinitionBodySchema,
  SetFieldValueBodySchema,
  UpdateFieldDefinitionBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  removeFieldBucketVisibility,
  setFieldBucketVisibility,
  listFieldBucketVisibility,
} from "../../services/field-bucket-visibility.service.js";
import { archiveFieldDefinition } from "../../services/field-definition/archive.js";
import { createFieldDefinition } from "../../services/field-definition/create.js";
import { deleteFieldDefinition } from "../../services/field-definition/delete.js";
import { getFieldDefinition } from "../../services/field-definition/get.js";
import { listFieldDefinitions } from "../../services/field-definition/list.js";
import { restoreFieldDefinition } from "../../services/field-definition/restore.js";
import { updateFieldDefinition } from "../../services/field-definition/update.js";
import {
  deleteFieldValueForOwner,
  listFieldValuesForOwner,
  setFieldValueForOwner,
} from "../../services/field-value.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

import type { FieldValueOwner } from "../../services/field-value.service.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for field list queries. */
const MAX_LIST_LIMIT = 100;

const FieldDefinitionIdSchema = z.object({
  fieldDefinitionId: brandedIdQueryParam("fld_"),
});

const BucketIdSchema = z.object({
  bucketId: brandedIdQueryParam("bkt_"),
});

const FieldOwnerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("member"), id: brandedIdQueryParam("mem_") }),
  z.object({ kind: z.literal("group"), id: brandedIdQueryParam("grp_") }),
  z.object({ kind: z.literal("structureEntity"), id: brandedIdQueryParam("ste_") }),
]);

/**
 * Zod's discriminatedUnion infers branded IDs per variant, but the merged
 * output type is not structurally identical to FieldValueOwner (readonly).
 * This single-point assertion bridges the gap.
 */
function toFieldValueOwner(owner: z.infer<typeof FieldOwnerSchema>): FieldValueOwner {
  return owner as FieldValueOwner;
}

export const fieldRouter = router({
  // ── Field definitions ─────────────────────────────────────────────

  definition: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateFieldDefinitionBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createFieldDefinition(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),

    get: systemProcedure
      .use(readLimiter)
      .input(FieldDefinitionIdSchema)
      .query(async ({ ctx, input }) => {
        return getFieldDefinition(ctx.db, ctx.systemId, input.fieldDefinitionId, ctx.auth);
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
        return listFieldDefinitions(ctx.db, ctx.systemId, ctx.auth, {
          cursor: input.cursor ?? undefined,
          limit: input.limit,
          includeArchived: input.includeArchived,
        });
      }),

    update: systemProcedure
      .use(writeLimiter)
      .input(FieldDefinitionIdSchema.and(UpdateFieldDefinitionBodySchema))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return updateFieldDefinition(
          ctx.db,
          ctx.systemId,
          input.fieldDefinitionId,
          input,
          ctx.auth,
          audit,
        );
      }),

    archive: systemProcedure
      .use(writeLimiter)
      .input(FieldDefinitionIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await archiveFieldDefinition(
          ctx.db,
          ctx.systemId,
          input.fieldDefinitionId,
          ctx.auth,
          audit,
        );
        return { success: true as const };
      }),

    restore: systemProcedure
      .use(writeLimiter)
      .input(FieldDefinitionIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return restoreFieldDefinition(
          ctx.db,
          ctx.systemId,
          input.fieldDefinitionId,
          ctx.auth,
          audit,
        );
      }),

    delete: systemProcedure
      .use(writeLimiter)
      .input(FieldDefinitionIdSchema.and(z.object({ force: z.boolean().default(false) })))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteFieldDefinition(
          ctx.db,
          ctx.systemId,
          input.fieldDefinitionId,
          ctx.auth,
          audit,
          { force: input.force },
        );
        return { success: true as const };
      }),
  }),

  // ── Field values ──────────────────────────────────────────────────

  value: router({
    set: systemProcedure
      .use(writeLimiter)
      .input(
        FieldDefinitionIdSchema.and(z.object({ owner: FieldOwnerSchema })).and(
          SetFieldValueBodySchema,
        ),
      )
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return setFieldValueForOwner(
          ctx.db,
          ctx.systemId,
          toFieldValueOwner(input.owner),
          input.fieldDefinitionId,
          input,
          ctx.auth,
          audit,
        );
      }),

    list: systemProcedure
      .use(readLimiter)
      .input(z.object({ owner: FieldOwnerSchema }))
      .query(async ({ ctx, input }) => {
        return listFieldValuesForOwner(
          ctx.db,
          ctx.systemId,
          toFieldValueOwner(input.owner),
          ctx.auth,
        );
      }),

    remove: systemProcedure
      .use(writeLimiter)
      .input(FieldDefinitionIdSchema.and(z.object({ owner: FieldOwnerSchema })))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteFieldValueForOwner(
          ctx.db,
          ctx.systemId,
          toFieldValueOwner(input.owner),
          input.fieldDefinitionId,
          ctx.auth,
          audit,
        );
        return { success: true as const };
      }),
  }),

  // ── Field bucket visibility ───────────────────────────────────────

  bucketVisibility: router({
    set: systemProcedure
      .use(writeLimiter)
      .input(FieldDefinitionIdSchema.and(BucketIdSchema))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return setFieldBucketVisibility(
          ctx.db,
          ctx.systemId,
          input.fieldDefinitionId,
          input.bucketId,
          ctx.auth,
          audit,
        );
      }),

    remove: systemProcedure
      .use(writeLimiter)
      .input(FieldDefinitionIdSchema.and(BucketIdSchema))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await removeFieldBucketVisibility(
          ctx.db,
          ctx.systemId,
          input.fieldDefinitionId,
          input.bucketId,
          ctx.auth,
          audit,
        );
        return { success: true as const };
      }),

    list: systemProcedure
      .use(readLimiter)
      .input(
        FieldDefinitionIdSchema.and(
          z.object({ limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional() }),
        ),
      )
      .query(async ({ ctx, input }) => {
        return listFieldBucketVisibility(ctx.db, ctx.systemId, input.fieldDefinitionId, ctx.auth, {
          limit: input.limit,
        });
      }),
  }),
});
