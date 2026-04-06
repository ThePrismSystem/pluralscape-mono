import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { listTagsByBucket, parseTagQuery } from "../../../services/bucket-content-tag.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listTagsRoute = new Hono<AuthEnv>();

listTagsRoute.use("*", createCategoryRateLimiter("readDefault"));
listTagsRoute.use("*", requireScopeMiddleware("read:buckets"));

listTagsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const query = parseTagQuery({ entityType: c.req.query("entityType") });

  const db = await getDb();
  const result = await listTagsByBucket(db, systemId, bucketId, auth, {
    entityType: query.entityType,
  });
  return c.json(envelope(result));
});
