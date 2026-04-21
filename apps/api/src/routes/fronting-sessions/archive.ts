import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { archiveFrontingSession } from "../../services/fronting-session/lifecycle.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:sessionId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sessionId = parseIdParam(c.req.param("sessionId"), ID_PREFIXES.frontingSession);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveFrontingSession(db, systemId, sessionId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
