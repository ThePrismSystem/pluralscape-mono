import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { removeFieldBucketVisibility } from "../../../services/field-bucket-visibility.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const removeVisibilityRoute = new Hono<AuthEnv>();

removeVisibilityRoute.use("*", createCategoryRateLimiter("write"));
removeVisibilityRoute.use("*", requireScopeMiddleware("delete:fields"));

removeVisibilityRoute.delete("/:bucketId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const fieldDefinitionId = requireIdParam(
    c.req.param("fieldDefinitionId"),
    "fieldDefinitionId",
    ID_PREFIXES.fieldDefinition,
  );
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removeFieldBucketVisibility(db, systemId, fieldDefinitionId, bucketId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
