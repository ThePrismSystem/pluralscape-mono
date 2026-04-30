import { ID_PREFIXES } from "@pluralscape/types";
import { VerifyPinBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../../http.constants.js";
import { createAuditWriter } from "../../../../lib/audit-writer.js";
import { parseBody } from "../../../../lib/body-parse.js";
import { getDb } from "../../../../lib/db.js";
import { requireIdParam } from "../../../../lib/id-param.js";
import { envelope } from "../../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../../middleware/rate-limit.js";
import { verifyPinCode } from "../../../../services/pin.service.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const verifyPinRoute = new Hono<AuthEnv>();

verifyPinRoute.use("*", createCategoryRateLimiter("authHeavy"));

verifyPinRoute.post("/", async (c) => {
  const body = await parseBody(c, VerifyPinBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await verifyPinCode(db, systemId, body, auth, audit);
  return c.json(envelope(result));
});
