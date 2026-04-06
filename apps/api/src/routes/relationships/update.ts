import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { updateRelationship } from "../../services/relationship.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));
updateRoute.use("*", requireScopeMiddleware("write:relationships"));

updateRoute.put("/:relationshipId", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const relationshipId = parseIdParam(c.req.param("relationshipId"), ID_PREFIXES.relationship);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateRelationship(db, systemId, relationshipId, body, auth, audit);
  return c.json(envelope(result));
});
