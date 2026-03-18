import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { archiveSideSystem } from "../../services/side-system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:sideSystemId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const sideSystemId = parseIdParam(c.req.param("sideSystemId"), ID_PREFIXES.sideSystem);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveSideSystem(db, systemId, sideSystemId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
