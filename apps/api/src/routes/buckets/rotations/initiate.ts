import { ID_PREFIXES } from "@pluralscape/types";
import { InitiateRotationBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createIdempotencyMiddleware } from "../../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { initiateRotation } from "../../../services/bucket/rotations/initiate.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const initiateRoute = new Hono<AuthEnv>();

initiateRoute.use("*", createCategoryRateLimiter("write"));
initiateRoute.use("*", createIdempotencyMiddleware());

initiateRoute.post("/", async (c) => {
  const body = await parseBody(c, InitiateRotationBodySchema);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await initiateRotation(db, systemId, bucketId, body, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
