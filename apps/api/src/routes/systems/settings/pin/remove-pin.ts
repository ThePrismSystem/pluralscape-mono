import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../../lib/audit-writer.js";
import { getDb } from "../../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../../middleware/rate-limit.js";
import { removePin } from "../../../../services/pin.service.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const removePinRoute = new Hono<AuthEnv>();

removePinRoute.use("*", createCategoryRateLimiter("authHeavy"));

removePinRoute.delete("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(requireParam(c.req.param("id"), "id"), ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removePin(db, systemId, auth, audit);
  return c.json({ success: true });
});
