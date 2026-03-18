import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../../http.constants.js";
import { ApiHttpError } from "../../../../lib/api-error.js";
import { createAuditWriter } from "../../../../lib/audit-writer.js";
import { getDb } from "../../../../lib/db.js";
import { requireIdParam } from "../../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../../middleware/rate-limit.js";
import { removePin } from "../../../../services/pin.service.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const removePinRoute = new Hono<AuthEnv>();

removePinRoute.use("*", createCategoryRateLimiter("authHeavy"));

removePinRoute.delete("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removePin(db, systemId, body, auth, audit);
  return c.json({ success: true });
});
