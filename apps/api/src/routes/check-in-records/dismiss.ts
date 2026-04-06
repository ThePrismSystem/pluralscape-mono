import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { dismissCheckInRecord } from "../../services/check-in-record.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const dismissRoute = new Hono<AuthEnv>();

dismissRoute.use("*", createCategoryRateLimiter("write"));

dismissRoute.post("/:recordId/dismiss", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const recordId = parseIdParam(c.req.param("recordId"), ID_PREFIXES.checkInRecord);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await dismissCheckInRecord(db, systemId, recordId, auth, audit);
  return c.json(envelope(result));
});
