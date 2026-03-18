import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { completeRotationChunk } from "../../../services/key-rotation.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const completeChunkRoute = new Hono<AuthEnv>();

completeChunkRoute.use("*", createCategoryRateLimiter("write"));

completeChunkRoute.post("/:rotationId/complete", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = parseIdParam(requireParam(c.req.param("id"), "id"), ID_PREFIXES.system);
  const bucketId = parseIdParam(
    requireParam(c.req.param("bucketId"), "bucketId"),
    ID_PREFIXES.bucket,
  );
  const rotationId = parseIdParam(c.req.param("rotationId"), ID_PREFIXES.bucketKeyRotation);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await completeRotationChunk(db, systemId, bucketId, rotationId, body, auth, audit);
  return c.json(result);
});
