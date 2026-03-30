import { ID_PREFIXES } from "@pluralscape/types";
import { IncludeArchivedQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listStructureEntities } from "../../../services/structure-entity.service.js";

import { DEFAULT_ENTITY_LIMIT, MAX_ENTITY_LIMIT } from "./structure.constants.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const { includeArchived } = IncludeArchivedQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
  });
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_ENTITY_LIMIT, MAX_ENTITY_LIMIT);
  const entityTypeId = c.req.query("entityTypeId");

  const db = await getDb();
  const result = await listStructureEntities(db, systemId, auth, {
    cursor: parseCursor(c.req.query("cursor")),
    limit,
    includeArchived,
    entityTypeId,
  });
  return c.json(result);
});
