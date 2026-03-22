import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { endFrontingSession } from "../../services/fronting-session.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const endRoute = new Hono<AuthEnv>();

endRoute.use("*", createCategoryRateLimiter("write"));

endRoute.post("/:sessionId/end", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sessionId = parseIdParam(c.req.param("sessionId"), ID_PREFIXES.frontingSession);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await endFrontingSession(db, systemId, sessionId, body, auth, audit);
  return c.json(result);
});
