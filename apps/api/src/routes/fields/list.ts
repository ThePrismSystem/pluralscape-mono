import { ID_PREFIXES } from "@pluralscape/types";
import { IncludeArchivedQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { filterFields, parseSparseFields } from "../../lib/sparse-fieldset.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { listFieldDefinitions } from "../../services/field-definition.service.js";

import { DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT } from "./fields.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { FieldDefinitionResult } from "../../services/field-definition.service.js";

const FIELD_DEF_FIELDS = [
  "id",
  "systemId",
  "fieldType",
  "required",
  "sortOrder",
  "encryptedData",
  "version",
  "createdAt",
  "updatedAt",
  "archived",
  "archivedAt",
] as const satisfies readonly (keyof FieldDefinitionResult)[];

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const { includeArchived } = IncludeArchivedQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
  });
  const limit = parsePaginationLimit(limitParam, DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT);
  const fields = parseSparseFields(c.req.query("fields"), FIELD_DEF_FIELDS);

  const db = await getDb();
  const result = await listFieldDefinitions(db, systemId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    includeArchived,
  });

  if (!fields) return c.json(result);

  return c.json({
    ...result,
    data: result.data.map((item) => filterFields(item, fields)),
  });
});
