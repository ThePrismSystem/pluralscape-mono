import { ID_PREFIXES } from "@pluralscape/types";
import { InnerWorldEntityQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listEntities } from "../../../services/innerworld/entity/queries.js";

import { DEFAULT_ENTITY_LIMIT, MAX_ENTITY_LIMIT } from "./entities.constants.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_ENTITY_LIMIT, MAX_ENTITY_LIMIT);
  const { regionId, includeArchived } = InnerWorldEntityQuerySchema.parse({
    regionId: c.req.query("regionId"),
    includeArchived: c.req.query("includeArchived"),
  });

  const db = await getDb();
  const result = await listEntities(db, systemId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    regionId,
    includeArchived,
  });
  return c.json(result);
});
