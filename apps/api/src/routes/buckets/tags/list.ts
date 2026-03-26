import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listTagsByBucket, parseTagQuery } from "../../../services/bucket-content-tag.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listTagsRoute = new Hono<AuthEnv>();

listTagsRoute.use("*", createCategoryRateLimiter("readDefault"));

listTagsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const query = parseTagQuery({ entityType: c.req.query("entityType") });

  const db = await getDb();
  const result = await listTagsByBucket(db, systemId, bucketId, auth, {
    entityType: query.entityType,
  });
  return c.json({ data: result });
});
