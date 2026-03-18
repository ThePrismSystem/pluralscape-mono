import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateFieldValue } from "../../../services/field-value.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:fieldDefId", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const memberId = parseIdParam(c.req.param("memberId") as string, ID_PREFIXES.member);
  const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateFieldValue(db, systemId, memberId, fieldDefId, body, auth, audit);
  return c.json(result);
});
