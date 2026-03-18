import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { archiveSubsystem } from "../../services/subsystem.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:subsystemId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const subsystemId = parseIdParam(c.req.param("subsystemId"), ID_PREFIXES.subsystem);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveSubsystem(db, systemId, subsystemId, auth, audit);
  return c.json({ ok: true });
});
