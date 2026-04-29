import { ID_PREFIXES } from "@pluralscape/types";
import { CompleteChunkBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { completeRotationChunk } from "../../../services/bucket/rotations/complete.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const completeChunkRoute = new Hono<AuthEnv>();

completeChunkRoute.use("*", createCategoryRateLimiter("write"));

completeChunkRoute.post("/:rotationId/complete", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = CompleteChunkBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid completion payload",
      parsed.error.issues,
    );
  }
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const rotationId = parseIdParam(c.req.param("rotationId"), ID_PREFIXES.bucketKeyRotation);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await completeRotationChunk(
    db,
    systemId,
    bucketId,
    rotationId,
    parsed.data,
    auth,
    audit,
  );
  return c.json(envelope(result));
});
