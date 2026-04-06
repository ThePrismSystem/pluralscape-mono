import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { archiveFrontingReport } from "../../services/fronting-report.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

/**
 * Archive returns 204 (void from generic `archiveEntity`) while restore returns 200 with body.
 * This pattern is consistent across all archive/restore pairs in the API.
 */
export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));
archiveRoute.use("*", requireScopeMiddleware("write:reports"));

archiveRoute.post("/:reportId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const reportId = parseIdParam(c.req.param("reportId"), ID_PREFIXES.frontingReport);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveFrontingReport(db, systemId, reportId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
