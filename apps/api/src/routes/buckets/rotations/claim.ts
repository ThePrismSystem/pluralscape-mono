import { ID_PREFIXES } from "@pluralscape/types";
import { ClaimChunkBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../http.constants.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { claimRotationChunk } from "../../../services/bucket/rotations/claim.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const claimRoute = new Hono<AuthEnv>();

claimRoute.use("*", createCategoryRateLimiter("write"));

claimRoute.post("/:rotationId/claim", async (c) => {
  const body = await parseBody(c, ClaimChunkBodySchema);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const rotationId = parseIdParam(c.req.param("rotationId"), ID_PREFIXES.bucketKeyRotation);

  const db = await getDb();
  const result = await claimRotationChunk(db, systemId, bucketId, rotationId, body, auth);
  return c.json(envelope(result));
});
