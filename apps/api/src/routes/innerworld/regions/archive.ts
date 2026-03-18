import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { archiveRegion } from "../../../services/innerworld-region.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:regionId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const regionId = parseIdParam(c.req.param("regionId"), ID_PREFIXES.innerWorldRegion);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveRegion(db, systemId, regionId, auth, audit);
  return c.json({ ok: true });
});
