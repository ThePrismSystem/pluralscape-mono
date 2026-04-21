import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { retryRotation } from "../../../services/key-rotation/retry.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const retryRoute = new Hono<AuthEnv>();

retryRoute.use("*", createCategoryRateLimiter("write"));

retryRoute.post("/:rotationId/retry", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const rotationId = parseIdParam(c.req.param("rotationId"), ID_PREFIXES.bucketKeyRotation);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await retryRotation(db, systemId, bucketId, rotationId, auth, audit);
  return c.json(envelope(result));
});
