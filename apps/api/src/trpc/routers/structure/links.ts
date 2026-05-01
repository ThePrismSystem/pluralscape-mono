import {
  CreateStructureEntityAssociationBodySchema,
  CreateStructureEntityLinkBodySchema,
  CreateStructureEntityMemberLinkBodySchema,
  UpdateStructureEntityLinkBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  createEntityAssociation,
  deleteEntityAssociation,
  listEntityAssociations,
} from "../../../services/structure/association.js";
import {
  createEntityLink,
  deleteEntityLink,
  listEntityLinks,
  updateEntityLink,
} from "../../../services/structure/link.js";
import {
  createEntityMemberLink,
  deleteEntityMemberLink,
  listEntityMemberLinks,
} from "../../../services/structure/member-link.js";
import { createTRPCCategoryRateLimiter } from "../../middlewares/rate-limit.js";
import { systemProcedure } from "../../middlewares/system.js";
import { router } from "../../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for structure list queries. */
const MAX_LIST_LIMIT = 100;

const LinkIdSchema = z.object({
  linkId: brandedIdQueryParam("stel_"),
});

const MemberLinkIdSchema = z.object({
  memberLinkId: brandedIdQueryParam("steml_"),
});

const AssociationIdSchema = z.object({
  associationId: brandedIdQueryParam("stea_"),
});

export const linkProcedures = {
  // ── Entity Links ─────────────────────────────────────────────────

  link: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateStructureEntityLinkBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createEntityLink(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),

    list: systemProcedure
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

    update: systemProcedure
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

    delete: systemProcedure
      .use(writeLimiter)
      .input(LinkIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteEntityLink(ctx.db, ctx.systemId, input.linkId, ctx.auth, audit);
        return { success: true as const };
      }),
  }),

  // ── Entity Member Links ──────────────────────────────────────────

  memberLink: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateStructureEntityMemberLinkBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createEntityMemberLink(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),

    list: systemProcedure
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

    delete: systemProcedure
      .use(writeLimiter)
      .input(MemberLinkIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteEntityMemberLink(ctx.db, ctx.systemId, input.memberLinkId, ctx.auth, audit);
        return { success: true as const };
      }),
  }),

  // ── Entity Associations ──────────────────────────────────────────

  association: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateStructureEntityAssociationBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createEntityAssociation(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),

    list: systemProcedure
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

    delete: systemProcedure
      .use(writeLimiter)
      .input(AssociationIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteEntityAssociation(ctx.db, ctx.systemId, input.associationId, ctx.auth, audit);
        return { success: true as const };
      }),
  }),
};
