import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { purgeSystem } from "../../services/system-purge.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const purgeRoute = new Hono<AuthEnv>();

purgeRoute.use("*", createCategoryRateLimiter("write"));

purgeRoute.post("/:id/purge", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id"), ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  await purgeSystem(db, systemId, body, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
