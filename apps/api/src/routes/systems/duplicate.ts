import { ID_PREFIXES } from "@pluralscape/types";
import { DuplicateSystemBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { duplicateSystem } from "../../services/system-duplicate.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const duplicateRoute = new Hono<AuthEnv>();

duplicateRoute.use("*", createCategoryRateLimiter("write"));
duplicateRoute.use("*", createIdempotencyMiddleware());

duplicateRoute.post("/:id/duplicate", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id"), ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const body = await parseBody(c, DuplicateSystemBodySchema);

  const db = await getDb();
  const result = await duplicateSystem(db, systemId, body, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
