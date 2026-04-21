import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { claimRotationChunk } from "../../../services/key-rotation/claim.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const claimRoute = new Hono<AuthEnv>();

claimRoute.use("*", createCategoryRateLimiter("write"));

claimRoute.post("/:rotationId/claim", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const rotationId = parseIdParam(c.req.param("rotationId"), ID_PREFIXES.bucketKeyRotation);

  const db = await getDb();
  const result = await claimRotationChunk(db, systemId, bucketId, rotationId, body, auth);
  return c.json(envelope(result));
});
