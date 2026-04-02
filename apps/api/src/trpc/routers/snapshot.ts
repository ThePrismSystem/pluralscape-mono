import { CreateSnapshotBodySchema, brandedIdQueryParam } from "@pluralscape/validation";
import { z } from "zod/v4";

import { createSnapshot, getSnapshot, listSnapshots } from "../../services/snapshot.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for snapshot list queries. */
const MAX_LIST_LIMIT = 100;

const SnapshotIdSchema = z.object({
  snapshotId: brandedIdQueryParam("snap_"),
});

export const snapshotRouter = router({
  create: systemProcedure.input(CreateSnapshotBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createSnapshot(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  get: systemProcedure.input(SnapshotIdSchema).query(async ({ ctx, input }) => {
    return getSnapshot(ctx.db, ctx.systemId, input.snapshotId, ctx.auth);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listSnapshots(ctx.db, ctx.systemId, ctx.auth, input.cursor, input.limit);
    }),
});
