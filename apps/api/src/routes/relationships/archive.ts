import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { archiveRelationship } from "../../services/relationship.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:relationshipId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const relationshipId = parseIdParam(c.req.param("relationshipId"), ID_PREFIXES.relationship);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveRelationship(db, systemId, relationshipId, auth, audit);
  return c.json({ ok: true });
});
