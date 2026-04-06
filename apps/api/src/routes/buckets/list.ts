import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listBuckets, parseBucketQuery } from "../../services/bucket.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.use("*", requireScopeMiddleware("read:buckets"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const query = parseBucketQuery({
    includeArchived: c.req.query("includeArchived"),
    archivedOnly: c.req.query("archivedOnly"),
  });

  const db = await getDb();
  const result = await listBuckets(db, systemId, auth, {
    cursor: c.req.query("cursor"),
    limit,
    includeArchived: query.includeArchived,
    archivedOnly: query.archivedOnly,
  });
  return c.json(result);
});
