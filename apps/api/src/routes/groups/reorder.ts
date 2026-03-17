import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { reorderGroups } from "../../services/group.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const reorderRoute = new Hono<AuthEnv>();

reorderRoute.use("*", createCategoryRateLimiter("write"));

reorderRoute.post("/reorder", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await reorderGroups(db, systemId, body, auth, audit);
  return c.json({ ok: true });
});
