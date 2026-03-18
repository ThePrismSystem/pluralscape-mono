import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { setFieldValue } from "../../../services/field-value.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const setRoute = new Hono<AuthEnv>();

setRoute.use("*", createCategoryRateLimiter("write"));

setRoute.post("/:fieldDefId", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const memberId = requireIdParam(c.req.param("memberId"), "memberId", ID_PREFIXES.member);
  const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await setFieldValue(db, systemId, memberId, fieldDefId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});
