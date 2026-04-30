import { ID_PREFIXES } from "@pluralscape/types";
import { RegisterDeviceTokenBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { registerDeviceToken } from "../../services/device-token/register.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const registerRoute = new Hono<AuthEnv>();

registerRoute.use("*", createCategoryRateLimiter("write"));
registerRoute.use("*", createIdempotencyMiddleware());

registerRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const body = await parseBody(c, RegisterDeviceTokenBodySchema);

  const db = await getDb();
  const result = await registerDeviceToken(db, systemId, body, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
