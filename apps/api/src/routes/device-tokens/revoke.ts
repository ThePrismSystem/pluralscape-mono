import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { revokeDeviceToken } from "../../services/device-token.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const revokeRoute = new Hono<AuthEnv>();

revokeRoute.use("*", createCategoryRateLimiter("write"));

revokeRoute.post("/:tokenId/revoke", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const tokenId = requireIdParam(c.req.param("tokenId"), "tokenId", ID_PREFIXES.deviceToken);

  const db = await getDb();
  await revokeDeviceToken(db, systemId, tokenId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
