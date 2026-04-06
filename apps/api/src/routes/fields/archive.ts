import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { archiveFieldDefinition } from "../../services/field-definition.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));
archiveRoute.use("*", requireScopeMiddleware("write:fields"));

archiveRoute.post("/:fieldId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const fieldId = parseIdParam(c.req.param("fieldId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveFieldDefinition(db, systemId, fieldId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
