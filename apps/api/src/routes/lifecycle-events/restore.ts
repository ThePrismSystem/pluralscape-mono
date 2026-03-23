import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { restoreLifecycleEvent } from "../../services/lifecycle-event.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));

restoreRoute.post("/:eventId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const eventId = parseIdParam(c.req.param("eventId"), ID_PREFIXES.lifecycleEvent);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreLifecycleEvent(db, systemId, eventId, auth, audit);
  return c.json(result);
});
