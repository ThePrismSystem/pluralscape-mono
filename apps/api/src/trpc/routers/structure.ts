import {
  CreateStructureEntityAssociationBodySchema,
  CreateStructureEntityBodySchema,
  CreateStructureEntityLinkBodySchema,
  CreateStructureEntityMemberLinkBodySchema,
  CreateStructureEntityTypeBodySchema,
  UpdateStructureEntityBodySchema,
  UpdateStructureEntityLinkBodySchema,
  UpdateStructureEntityTypeBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  createEntityAssociation,
  deleteEntityAssociation,
  getEntityHierarchy,
  listEntityAssociations,
} from "../../services/structure-entity-association.service.js";
import {
  archiveStructureEntity,
  createStructureEntity,
  deleteStructureEntity,
  getStructureEntity,
  listStructureEntities,
  restoreStructureEntity,
  updateStructureEntity,
} from "../../services/structure-entity-crud.service.js";
import {
  createEntityLink,
  deleteEntityLink,
  listEntityLinks,
  updateEntityLink,
} from "../../services/structure-entity-link.service.js";
import {
  createEntityMemberLink,
  deleteEntityMemberLink,
  listEntityMemberLinks,
} from "../../services/structure-entity-member-link.service.js";
import {
  archiveEntityType,
  createEntityType,
  deleteEntityType,
  getEntityType,
  listEntityTypes,
  restoreEntityType,
  updateEntityType,
} from "../../services/structure-entity-type.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

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

const LinkIdSchema = z.object({
  linkId: brandedIdQueryParam("stel_"),
});

const MemberLinkIdSchema = z.object({
  memberLinkId: brandedIdQueryParam("steml_"),
});

const AssociationIdSchema = z.object({
  associationId: brandedIdQueryParam("stea_"),
});

export const structureRouter = router({
  // ── Entity Types ─────────────────────────────────────────────────

  createType: systemProcedure
    .use(writeLimiter)
    .input(CreateStructureEntityTypeBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityType(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  getType: systemProcedure
    .use(readLimiter)
    .input(EntityTypeIdSchema)
    .query(async ({ ctx, input }) => {
      return getEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth);
    }),

  listTypes: systemProcedure
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

  updateType: systemProcedure
    .use(writeLimiter)
    .input(EntityTypeIdSchema.and(UpdateStructureEntityTypeBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateEntityType(
        ctx.db,
        ctx.systemId,
        input.entityTypeId,
        { encryptedData: input.encryptedData, sortOrder: input.sortOrder, version: input.version },
        ctx.auth,
        audit,
      );
    }),

  archiveType: systemProcedure
    .use(writeLimiter)
    .input(EntityTypeIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
      return { success: true as const };
    }),

  restoreType: systemProcedure
    .use(writeLimiter)
    .input(EntityTypeIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
    }),

  deleteType: systemProcedure
    .use(writeLimiter)
    .input(EntityTypeIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
      return { success: true as const };
    }),

  // ── Structure Entities ───────────────────────────────────────────

  createEntity: systemProcedure
    .use(writeLimiter)
    .input(CreateStructureEntityBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createStructureEntity(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  getEntity: systemProcedure
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

  listEntities: systemProcedure
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

  updateEntity: systemProcedure
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

  archiveEntity: systemProcedure
    .use(writeLimiter)
    .input(EntityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await archiveStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
      return { success: true as const };
    }),

  restoreEntity: systemProcedure
    .use(writeLimiter)
    .input(EntityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return restoreStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
    }),

  deleteEntity: systemProcedure
    .use(writeLimiter)
    .input(EntityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
      return { success: true as const };
    }),

  // ── Entity Links ─────────────────────────────────────────────────

  createLink: systemProcedure
    .use(writeLimiter)
    .input(CreateStructureEntityLinkBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityLink(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  listLinks: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listEntityLinks(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
      });
    }),

  updateLink: systemProcedure
    .use(writeLimiter)
    .input(LinkIdSchema.and(UpdateStructureEntityLinkBodySchema))
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return updateEntityLink(
        ctx.db,
        ctx.systemId,
        input.linkId,
        { sortOrder: input.sortOrder },
        ctx.auth,
        audit,
      );
    }),

  deleteLink: systemProcedure
    .use(writeLimiter)
    .input(LinkIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteEntityLink(ctx.db, ctx.systemId, input.linkId, ctx.auth, audit);
      return { success: true as const };
    }),

  // ── Entity Member Links ──────────────────────────────────────────

  createMemberLink: systemProcedure
    .use(writeLimiter)
    .input(CreateStructureEntityMemberLinkBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityMemberLink(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  listMemberLinks: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listEntityMemberLinks(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
      });
    }),

  deleteMemberLink: systemProcedure
    .use(writeLimiter)
    .input(MemberLinkIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteEntityMemberLink(ctx.db, ctx.systemId, input.memberLinkId, ctx.auth, audit);
      return { success: true as const };
    }),

  // ── Entity Associations ──────────────────────────────────────────

  createAssociation: systemProcedure
    .use(writeLimiter)
    .input(CreateStructureEntityAssociationBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityAssociation(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  listAssociations: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listEntityAssociations(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
      });
    }),

  deleteAssociation: systemProcedure
    .use(writeLimiter)
    .input(AssociationIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await deleteEntityAssociation(ctx.db, ctx.systemId, input.associationId, ctx.auth, audit);
      return { success: true as const };
    }),
});
