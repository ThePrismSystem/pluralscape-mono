import {
  CreateStructureEntityBodySchema,
  CreateStructureEntityTypeBodySchema,
  UpdateStructureEntityBodySchema,
  UpdateStructureEntityTypeBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { getEntityHierarchy } from "../../services/structure/association.js";
import { createStructureEntity } from "../../services/structure/entity-crud/create.js";
import {
  archiveStructureEntity,
  deleteStructureEntity,
  restoreStructureEntity,
} from "../../services/structure/entity-crud/lifecycle.js";
import {
  getStructureEntity,
  listStructureEntities,
} from "../../services/structure/entity-crud/queries.js";
import { updateStructureEntity } from "../../services/structure/entity-crud/update.js";
import { archiveEntityType } from "../../services/structure/entity-type/archive.js";
import { createEntityType } from "../../services/structure/entity-type/create.js";
import { deleteEntityType } from "../../services/structure/entity-type/delete.js";
import { getEntityType } from "../../services/structure/entity-type/get.js";
import { listEntityTypes } from "../../services/structure/entity-type/list.js";
import { restoreEntityType } from "../../services/structure/entity-type/restore.js";
import { updateEntityType } from "../../services/structure/entity-type/update.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

import { linkProcedures } from "./structure/links.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for structure list queries. */
const MAX_LIST_LIMIT = 100;

const EntityTypeIdSchema = z.object({
  entityTypeId: brandedIdQueryParam("stet_"),
});

const EntityIdSchema = z.object({
  entityId: brandedIdQueryParam("ste_"),
});

export const structureRouter = router({
  // ── Entity Types ─────────────────────────────────────────────────

  entityType: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateStructureEntityTypeBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createEntityType(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),

    get: systemProcedure
      .use(readLimiter)
      .input(EntityTypeIdSchema)
      .query(async ({ ctx, input }) => {
        return getEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth);
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
        return listEntityTypes(ctx.db, ctx.systemId, ctx.auth, {
          cursor: input.cursor ?? undefined,
          limit: input.limit,
          includeArchived: input.includeArchived,
        });
      }),

    update: systemProcedure
      .use(writeLimiter)
      .input(EntityTypeIdSchema.and(UpdateStructureEntityTypeBodySchema))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return updateEntityType(
          ctx.db,
          ctx.systemId,
          input.entityTypeId,
          {
            encryptedData: input.encryptedData,
            sortOrder: input.sortOrder,
            version: input.version,
          },
          ctx.auth,
          audit,
        );
      }),

    archive: systemProcedure
      .use(writeLimiter)
      .input(EntityTypeIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await archiveEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
        return { success: true as const };
      }),

    restore: systemProcedure
      .use(writeLimiter)
      .input(EntityTypeIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return restoreEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
      }),

    delete: systemProcedure
      .use(writeLimiter)
      .input(EntityTypeIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
        return { success: true as const };
      }),
  }),

  // ── Structure Entities ───────────────────────────────────────────

  entity: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateStructureEntityBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createStructureEntity(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),

    get: systemProcedure
      .use(readLimiter)
      .input(EntityIdSchema)
      .query(async ({ ctx, input }) => {
        return getStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth);
      }),

    getHierarchy: systemProcedure
      .use(readLimiter)
      .input(EntityIdSchema)
      .query(async ({ ctx, input }) => {
        return getEntityHierarchy(ctx.db, ctx.systemId, input.entityId, ctx.auth);
      }),

    list: systemProcedure
      .use(readLimiter)
      .input(
        z.object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          includeArchived: z.boolean().default(false),
          entityTypeId: brandedIdQueryParam("stet_").optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return listStructureEntities(ctx.db, ctx.systemId, ctx.auth, {
          cursor: input.cursor ?? undefined,
          limit: input.limit,
          includeArchived: input.includeArchived,
          entityTypeId: input.entityTypeId,
        });
      }),

    update: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema.and(UpdateStructureEntityBodySchema))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return updateStructureEntity(
          ctx.db,
          ctx.systemId,
          input.entityId,
          {
            encryptedData: input.encryptedData,
            sortOrder: input.sortOrder,
            version: input.version,
            parentEntityId: input.parentEntityId,
          },
          ctx.auth,
          audit,
        );
      }),

    archive: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await archiveStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
        return { success: true as const };
      }),

    restore: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return restoreStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
      }),

    delete: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
        return { success: true as const };
      }),
  }),

  ...linkProcedures,
});
