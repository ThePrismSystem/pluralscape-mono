import { ID_PREFIXES } from "@pluralscape/types";
import { SetFieldBucketVisibilityBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { setFieldBucketVisibility } from "../../../services/field-bucket-visibility.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const setVisibilityRoute = new Hono<AuthEnv>();

setVisibilityRoute.use("*", createCategoryRateLimiter("write"));

setVisibilityRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const fieldDefinitionId = requireIdParam(
    c.req.param("fieldDefinitionId"),
    "fieldDefinitionId",
    ID_PREFIXES.fieldDefinition,
  );
  const audit = createAuditWriter(c, auth);
  const body = await parseBody(c, SetFieldBucketVisibilityBodySchema);

  const db = await getDb();
  const result = await setFieldBucketVisibility(
    db,
    systemId,
    fieldDefinitionId,
    body.bucketId,
    auth,
    audit,
  );
  return c.json(envelope(result), HTTP_CREATED);
});
