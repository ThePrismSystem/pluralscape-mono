import { ID_PREFIXES } from "@pluralscape/types";
import { IncludeArchivedQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listRegions } from "../../../services/innerworld/region/queries.js";

import { DEFAULT_REGION_LIMIT, MAX_REGION_LIMIT } from "./regions.constants.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_REGION_LIMIT, MAX_REGION_LIMIT);
  const { includeArchived } = IncludeArchivedQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
  });

  const db = await getDb();
  const result = await listRegions(db, systemId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    includeArchived,
  });
  return c.json(result);
});
