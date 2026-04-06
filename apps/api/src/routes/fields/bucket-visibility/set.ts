import { ID_PREFIXES } from "@pluralscape/types";
import { SetFieldBucketVisibilityBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { setFieldBucketVisibility } from "../../../services/field-bucket-visibility.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const setVisibilityRoute = new Hono<AuthEnv>();

setVisibilityRoute.use("*", createCategoryRateLimiter("write"));
setVisibilityRoute.use("*", requireScopeMiddleware("write:fields"));

setVisibilityRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const fieldDefinitionId = requireIdParam(
    c.req.param("fieldDefinitionId"),
    "fieldDefinitionId",
    ID_PREFIXES.fieldDefinition,
  );
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);
  const parsed = SetFieldBucketVisibilityBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid set visibility payload");
  }

  const db = await getDb();
  const result = await setFieldBucketVisibility(
    db,
    systemId,
    fieldDefinitionId,
    parsed.data.bucketId,
    auth,
    audit,
  );
  return c.json(envelope(result), HTTP_CREATED);
});
