import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getRotationProgress } from "../../../services/key-rotation/queries.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const progressRoute = new Hono<AuthEnv>();

progressRoute.use("*", createCategoryRateLimiter("readDefault"));
progressRoute.get("/:rotationId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const rotationId = parseIdParam(c.req.param("rotationId"), ID_PREFIXES.bucketKeyRotation);

  const db = await getDb();
  const result = await getRotationProgress(db, systemId, bucketId, rotationId, auth);
  return c.json(envelope(result));
});
