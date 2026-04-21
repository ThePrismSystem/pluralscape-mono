import { ID_PREFIXES, IMPORT_ENTITY_TYPES, IMPORT_SOURCES } from "@pluralscape/types";
import { Hono } from "hono";
import { z } from "zod/v4";

import { HTTP_BAD_REQUEST, HTTP_OK } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listImportEntityRefs } from "../../../services/system/import-entity-refs/list.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

const MAX_SOURCE_ENTITY_ID_LENGTH = 128;

const QuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
    source: z.enum(IMPORT_SOURCES).optional(),
    entityType: z.enum(IMPORT_ENTITY_TYPES).optional(),
    sourceEntityId: z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH).optional(),
  })
  .strict();

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = QuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters", {
      issues: parsed.error.issues,
    });
  }

  const db = await getDb();
  const result = await listImportEntityRefs(db, systemId, auth, parsed.data);
  return c.json(result, HTTP_OK);
});
