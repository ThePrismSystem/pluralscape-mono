import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { restoreEntityType } from "../../../services/structure-entity.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));

restoreRoute.post("/:entityTypeId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const entityTypeId = parseIdParam(c.req.param("entityTypeId"), ID_PREFIXES.structureEntityType);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreEntityType(db, systemId, entityTypeId, auth, audit);
  return c.json(envelope(result));
});
