import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateFrontingReportBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateFrontingReport } from "../../services/fronting-report/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:reportId", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = UpdateFrontingReportBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const reportId = parseIdParam(c.req.param("reportId"), ID_PREFIXES.frontingReport);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateFrontingReport(db, systemId, reportId, parsed.data, auth, audit);
  return c.json(envelope(result));
});
