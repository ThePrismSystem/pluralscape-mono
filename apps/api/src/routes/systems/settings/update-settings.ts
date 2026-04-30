import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateSystemSettingsBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateSystemSettings } from "../../../services/system-settings.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateSettingsRoute = new Hono<AuthEnv>();

updateSettingsRoute.use("*", createCategoryRateLimiter("write"));

updateSettingsRoute.put("/", async (c) => {
  const body = await parseBody(c, UpdateSystemSettingsBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateSystemSettings(db, systemId, body, auth, audit);
  return c.json(envelope(result));
});
