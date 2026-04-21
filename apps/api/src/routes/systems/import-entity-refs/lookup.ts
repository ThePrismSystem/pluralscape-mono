import { ID_PREFIXES, IMPORT_ENTITY_TYPES, IMPORT_SOURCES } from "@pluralscape/types";
import { Hono } from "hono";
import { z } from "zod/v4";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_OK } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { lookupImportEntityRef } from "../../../services/import-entity-ref/lookup.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

const MAX_SOURCE_ENTITY_ID_LENGTH = 128;

const QuerySchema = z
  .object({
    source: z.enum(IMPORT_SOURCES),
    sourceEntityType: z.enum(IMPORT_ENTITY_TYPES),
    sourceEntityId: z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH),
  })
  .strict();

export const lookupRoute = new Hono<AuthEnv>();

lookupRoute.use("*", createCategoryRateLimiter("readDefault"));

lookupRoute.get("/", async (c) => {
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
  const result = await lookupImportEntityRef(db, systemId, parsed.data, auth);
  if (!result) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Import entity ref not found");
  }
  return c.json(envelope(result), HTTP_OK);
});
