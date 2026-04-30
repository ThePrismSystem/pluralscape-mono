import { ID_PREFIXES } from "@pluralscape/types";
import { EndFrontingSessionBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { endFrontingSession } from "../../services/fronting-session/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const endRoute = new Hono<AuthEnv>();

endRoute.use("*", createCategoryRateLimiter("write"));

endRoute.post("/:sessionId/end", async (c) => {
  const body = await parseBody(c, EndFrontingSessionBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sessionId = parseIdParam(c.req.param("sessionId"), ID_PREFIXES.frontingSession);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await endFrontingSession(db, systemId, sessionId, body, auth, audit);
  return c.json(envelope(result));
});
