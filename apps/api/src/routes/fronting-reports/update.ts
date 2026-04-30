import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateFrontingReportBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateFrontingReport } from "../../services/fronting-report/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:reportId", async (c) => {
  const body = await parseBody(c, UpdateFrontingReportBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const reportId = parseIdParam(c.req.param("reportId"), ID_PREFIXES.frontingReport);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateFrontingReport(db, systemId, reportId, body, auth, audit);
  return c.json(envelope(result));
});
