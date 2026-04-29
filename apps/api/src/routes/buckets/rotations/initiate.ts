import { ID_PREFIXES } from "@pluralscape/types";
import { InitiateRotationBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createIdempotencyMiddleware } from "../../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { initiateRotation } from "../../../services/bucket/rotations/initiate.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const initiateRoute = new Hono<AuthEnv>();

initiateRoute.use("*", createCategoryRateLimiter("write"));
initiateRoute.use("*", createIdempotencyMiddleware());

initiateRoute.post("/", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = InitiateRotationBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await initiateRotation(db, systemId, bucketId, parsed.data, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
