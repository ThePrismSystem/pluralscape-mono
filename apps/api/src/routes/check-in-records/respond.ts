import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { respondCheckInRecord } from "../../services/check-in-record/respond.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const respondRoute = new Hono<AuthEnv>();

respondRoute.use("*", createCategoryRateLimiter("write"));

respondRoute.post("/:recordId/respond", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const recordId = parseIdParam(c.req.param("recordId"), ID_PREFIXES.checkInRecord);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await respondCheckInRecord(db, systemId, recordId, body, auth, audit);
  return c.json(envelope(result));
});
