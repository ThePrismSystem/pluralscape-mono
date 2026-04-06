import { CreateApiKeyBodySchema, brandedIdQueryParam } from "@pluralscape/validation";
import { z } from "zod/v4";

import {
  createApiKey,
  getApiKey,
  listApiKeys,
  revokeApiKey,
} from "../../services/api-key.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { requireScope } from "../middlewares/scope.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");
const writeLimiter = createTRPCCategoryRateLimiter("write");

/** Maximum items per page for API key list queries. */
const MAX_LIST_LIMIT = 100;

const ApiKeyIdSchema = z.object({
  apiKeyId: brandedIdQueryParam("ak_"),
});

export const apiKeyRouter = router({
  create: systemProcedure
    .use(writeLimiter)
    .use(requireScope("full"))
    .input(CreateApiKeyBodySchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      return createApiKey(ctx.db, ctx.systemId, input, ctx.auth, audit);
    }),

  get: systemProcedure
    .use(readLimiter)
    .use(requireScope("full"))
    .input(ApiKeyIdSchema)
    .query(async ({ ctx, input }) => {
      return getApiKey(ctx.db, ctx.systemId, input.apiKeyId, ctx.auth);
    }),

  list: systemProcedure
    .use(readLimiter)
    .use(requireScope("full"))
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        includeRevoked: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listApiKeys(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        includeRevoked: input.includeRevoked,
      });
    }),

  revoke: systemProcedure
    .use(writeLimiter)
    .use(requireScope("full"))
    .input(ApiKeyIdSchema)
    .mutation(async ({ ctx, input }) => {
      const audit = ctx.createAudit(ctx.auth);
      await revokeApiKey(ctx.db, ctx.systemId, input.apiKeyId, ctx.auth, audit);
      return { success: true as const };
    }),
});
