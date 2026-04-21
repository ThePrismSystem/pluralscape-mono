import {
  CreateEntityBodySchema,
  CreateRegionBodySchema,
  UpdateCanvasBodySchema,
  UpdateEntityBodySchema,
  UpdateRegionBodySchema,
  brandedIdQueryParam,
} from "@pluralscape/validation";
import { z } from "zod/v4";

import { getCanvas, upsertCanvas } from "../../services/innerworld/canvas.js";
import { createEntity } from "../../services/innerworld/entity/create.js";
import {
  archiveEntity,
  deleteEntity,
  restoreEntity,
} from "../../services/innerworld/entity/lifecycle.js";
import { getEntity, listEntities } from "../../services/innerworld/entity/queries.js";
import { updateEntity } from "../../services/innerworld/entity/update.js";
import { createRegion } from "../../services/innerworld/region/create.js";
import {
  archiveRegion,
  deleteRegion,
  restoreRegion,
} from "../../services/innerworld/region/lifecycle.js";
import { getRegion, listRegions } from "../../services/innerworld/region/queries.js";
import { updateRegion } from "../../services/innerworld/region/update.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for innerworld list queries. */
const MAX_LIST_LIMIT = 100;

const EntityIdSchema = z.object({
  entityId: brandedIdQueryParam("iwe_"),
});

const RegionIdSchema = z.object({
  regionId: brandedIdQueryParam("iwr_"),
});

export const innerworldRouter = router({
  entity: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateEntityBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createEntity(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
    get: systemProcedure
      .use(readLimiter)
      .input(EntityIdSchema)
      .query(async ({ ctx, input }) => {
        return getEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth);
      }),
    list: systemProcedure
      .use(readLimiter)
      .input(
        z.object({
          cursor: z.string().nullish(),
          limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
          regionId: brandedIdQueryParam("iwr_").optional(),
          includeArchived: z.boolean().default(false),
        }),
      )
      .query(async ({ ctx, input }) => {
        return listEntities(ctx.db, ctx.systemId, ctx.auth, {
          cursor: input.cursor ?? undefined,
          limit: input.limit,
          regionId: input.regionId,
          includeArchived: input.includeArchived,
        });
      }),
    update: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema.and(UpdateEntityBodySchema))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return updateEntity(
          ctx.db,
          ctx.systemId,
          input.entityId,
          { encryptedData: input.encryptedData, version: input.version },
          ctx.auth,
          audit,
        );
      }),
    archive: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await archiveEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
        return { success: true as const };
      }),
    restore: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return restoreEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
      }),
    delete: systemProcedure
      .use(writeLimiter)
      .input(EntityIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteEntity(ctx.db, ctx.systemId, input.entityId, ctx.auth, audit);
        return { success: true as const };
      }),
  }),

  region: router({
    create: systemProcedure
      .use(writeLimiter)
      .input(CreateRegionBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return createRegion(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
    get: systemProcedure
      .use(readLimiter)
      .input(RegionIdSchema)
      .query(async ({ ctx, input }) => {
        return getRegion(ctx.db, ctx.systemId, input.regionId, ctx.auth);
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
        return listRegions(ctx.db, ctx.systemId, ctx.auth, {
          cursor: input.cursor ?? undefined,
          limit: input.limit,
          includeArchived: input.includeArchived,
        });
      }),
    update: systemProcedure
      .use(writeLimiter)
      .input(RegionIdSchema.and(UpdateRegionBodySchema))
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return updateRegion(
          ctx.db,
          ctx.systemId,
          input.regionId,
          { encryptedData: input.encryptedData, version: input.version },
          ctx.auth,
          audit,
        );
      }),
    archive: systemProcedure
      .use(writeLimiter)
      .input(RegionIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await archiveRegion(ctx.db, ctx.systemId, input.regionId, ctx.auth, audit);
        return { success: true as const };
      }),
    restore: systemProcedure
      .use(writeLimiter)
      .input(RegionIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return restoreRegion(ctx.db, ctx.systemId, input.regionId, ctx.auth, audit);
      }),
    delete: systemProcedure
      .use(writeLimiter)
      .input(RegionIdSchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        await deleteRegion(ctx.db, ctx.systemId, input.regionId, ctx.auth, audit);
        return { success: true as const };
      }),
  }),

  canvas: router({
    get: systemProcedure.use(readLimiter).query(async ({ ctx }) => {
      return getCanvas(ctx.db, ctx.systemId, ctx.auth);
    }),
    upsert: systemProcedure
      .use(writeLimiter)
      .input(UpdateCanvasBodySchema)
      .mutation(async ({ ctx, input }) => {
        const audit = ctx.createAudit(ctx.auth);
        return upsertCanvas(ctx.db, ctx.systemId, input, ctx.auth, audit);
      }),
  }),
});
