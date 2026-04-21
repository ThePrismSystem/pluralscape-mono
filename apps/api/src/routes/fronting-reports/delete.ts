import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { deleteFrontingReport } from "../../services/fronting-report/delete.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:reportId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const reportId = requireIdParam(c.req.param("reportId"), "reportId", ID_PREFIXES.frontingReport);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteFrontingReport(db, systemId, reportId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
