import { ID_PREFIXES, isBucketContentEntityType } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_NO_CONTENT } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { untagContent } from "../../../services/bucket-content-tag.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const untagRoute = new Hono<AuthEnv>();

untagRoute.use("*", createCategoryRateLimiter("write"));
untagRoute.use("*", requireScopeMiddleware("write:buckets"));

untagRoute.delete("/:entityType/:entityId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const entityType = c.req.param("entityType");
  const entityId = c.req.param("entityId");
  const audit = createAuditWriter(c, auth);

  if (!isBucketContentEntityType(entityType)) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid entityType");
  }

  const db = await getDb();
  await untagContent(db, systemId, bucketId, entityType, entityId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
