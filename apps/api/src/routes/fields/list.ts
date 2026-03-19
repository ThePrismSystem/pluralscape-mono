import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { IncludeArchivedQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { listFieldDefinitions } from "../../services/field-definition.service.js";

import { DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT } from "./fields.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

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

  const db = await getDb();
  const result = await listFieldDefinitions(db, systemId, auth, {
    cursor: cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    includeArchived,
  });
  return c.json(result);
});
