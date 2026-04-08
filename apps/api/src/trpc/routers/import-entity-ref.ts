import { z } from "zod/v4";

import {
  listImportEntityRefs,
  lookupImportEntityRef,
} from "../../services/import-entity-ref.service.js";
import { createTRPCCategoryRateLimiter } from "../middlewares/rate-limit.js";
import { systemProcedure } from "../middlewares/system.js";
import { router } from "../trpc.js";

const readLimiter = createTRPCCategoryRateLimiter("readDefault");

/** Maximum items per page for entity-ref list queries. */
const MAX_LIST_LIMIT = 100;

/** Maximum length of a source-side identifier. Matches the PG varchar(128). */
const MAX_SOURCE_ENTITY_ID_LENGTH = 128;

const IMPORT_SOURCES = ["simply-plural", "pluralkit", "pluralscape"] as const;
const IMPORT_ENTITY_TYPES = [
  "member",
  "group",
  "fronting-session",
  "switch",
  "custom-field",
  "note",
  "chat-message",
  "board-message",
  "poll",
  "timer",
  "privacy-bucket",
  "friend",
  "unknown",
] as const;

export const importEntityRefRouter = router({
  list: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
        source: z.enum(IMPORT_SOURCES).optional(),
        entityType: z.enum(IMPORT_ENTITY_TYPES).optional(),
        sourceEntityId: z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return listImportEntityRefs(ctx.db, ctx.systemId, ctx.auth, {
        cursor: input.cursor ?? undefined,
        limit: input.limit,
        source: input.source,
        entityType: input.entityType,
        sourceEntityId: input.sourceEntityId,
      });
    }),

  lookup: systemProcedure
    .use(readLimiter)
    .input(
      z.object({
        source: z.enum(IMPORT_SOURCES),
        sourceEntityType: z.enum(IMPORT_ENTITY_TYPES),
        sourceEntityId: z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH),
      }),
    )
    .query(async ({ ctx, input }) => {
      return lookupImportEntityRef(ctx.db, ctx.systemId, input, ctx.auth);
    }),
});
