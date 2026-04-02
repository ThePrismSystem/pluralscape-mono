import { CreateApiKeyBodySchema, brandedIdQueryParam } from "@pluralscape/validation";
import { z } from "zod/v4";

import { createApiKey, listApiKeys, revokeApiKey } from "../../services/api-key.service.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

/** Maximum items per page for API key list queries. */
const MAX_LIST_LIMIT = 100;

const ApiKeyIdSchema = z.object({
  apiKeyId: brandedIdQueryParam("ak_"),
});

export const apiKeyRouter = router({
  create: systemProcedure.input(CreateApiKeyBodySchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    return createApiKey(ctx.db, ctx.systemId, input, ctx.auth, audit);
  }),

  list: systemProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeRevoked: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listApiKeys(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor,
        limit: input.limit,
        includeRevoked: input.includeRevoked,
      });
    }),

  revoke: systemProcedure.input(ApiKeyIdSchema).mutation(async ({ ctx, input }) => {
    const audit = ctx.createAudit(ctx.auth);
    await revokeApiKey(ctx.db, ctx.systemId, input.apiKeyId, ctx.auth, audit);
    return { success: true as const };
  }),
});
