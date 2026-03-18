import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { restoreEntity } from "../../../services/innerworld-entity.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));

restoreRoute.post("/:entityId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const entityId = parseIdParam(c.req.param("entityId"), ID_PREFIXES.innerWorldEntity);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreEntity(db, systemId, entityId, auth, audit);
  return c.json(result);
});
