import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateDeviceTokenBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateDeviceToken } from "../../services/device-token/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:tokenId", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const tokenId = requireIdParam(c.req.param("tokenId"), "tokenId", ID_PREFIXES.deviceToken);
  const body = await parseBody(c, UpdateDeviceTokenBodySchema);

  const db = await getDb();
  const result = await updateDeviceToken(db, systemId, tokenId, body, auth, audit);
  return c.json(envelope(result));
});
