import { ID_PREFIXES } from "@pluralscape/types";
import { IncludeArchivedQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listStructureEntities } from "../../../services/structure-entity.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.use("*", requireScopeMiddleware("read:structure"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const { includeArchived } = IncludeArchivedQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
  });
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const entityTypeIdParam = c.req.query("entityTypeId");
  const entityTypeId = entityTypeIdParam
    ? parseIdParam(entityTypeIdParam, ID_PREFIXES.structureEntityType)
    : undefined;

  const db = await getDb();
  const result = await listStructureEntities(db, systemId, auth, {
    cursor: parseCursor(c.req.query("cursor")),
    limit,
    includeArchived,
    entityTypeId,
  });
  return c.json(result);
});
