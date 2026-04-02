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
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

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
    .input(CreateStructureEntityTypeBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityType(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  getType: systemProcedure.input(EntityTypeIdSchema).query(async ({ ctx, input }) => {
    return getEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth);
  }),

  listTypes: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listEntityTypes(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
      });
    }),

  updateType: systemProcedure
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

  archiveType: systemProcedure.input(EntityTypeIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
    return { success: true as const };
  }),

  restoreType: systemProcedure.input(EntityTypeIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
  }),

  deleteType: systemProcedure.input(EntityTypeIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteEntityType(ctx.db, ctx.systemId, input.entityTypeId, ctx.auth, audit);
    return { success: true as const };
  }),

  // ── Structure Entities ───────────────────────────────────────────

  createEntity: systemProcedure
    .input(CreateStructureEntityBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createStructureEntity(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  getEntity: systemProcedure.input(EntityIdSchema).query(async ({ ctx, input }) => {
    return getStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth);
  }),

  listEntities: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeArchived: z.boolean().default(false),
        entityTypeId: brandedIdQueryParam("stet_").optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listStructureEntities(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeArchived: input.includeArchived,
        entityTypeId: input.entityTypeId,
      });
    }),

  updateEntity: systemProcedure
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

  archiveEntity: systemProcedure.input(EntityIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await archiveStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
    return { success: true as const };
  }),

  restoreEntity: systemProcedure.input(EntityIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return restoreStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
  }),

  deleteEntity: systemProcedure.input(EntityIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteStructureEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
    return { success: true as const };
  }),

  // ── Entity Links ─────────────────────────────────────────────────

  createLink: systemProcedure
    .input(CreateStructureEntityLinkBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityLink(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  listLinks: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listEntityLinks(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
      });
    }),

  updateLink: systemProcedure
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

  deleteLink: systemProcedure.input(LinkIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteEntityLink(ctx.db, ctx.systemId, input.linkId, ctx.auth, audit);
    return { success: true as const };
  }),

  // ── Entity Member Links ──────────────────────────────────────────

  createMemberLink: systemProcedure
    .input(CreateStructureEntityMemberLinkBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityMemberLink(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  listMemberLinks: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listEntityMemberLinks(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
      });
    }),

  deleteMemberLink: systemProcedure.input(MemberLinkIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteEntityMemberLink(ctx.db, ctx.systemId, input.memberLinkId, ctx.auth, audit);
    return { success: true as const };
  }),

  // ── Entity Associations ──────────────────────────────────────────

  createAssociation: systemProcedure
    .input(CreateStructureEntityAssociationBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createEntityAssociation(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  listAssociations: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listEntityAssociations(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
      });
    }),

  deleteAssociation: systemProcedure.input(AssociationIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await deleteEntityAssociation(ctx.db, ctx.systemId, input.associationId, ctx.auth, audit);
    return { success: true as const };
  }),
});
