import { VerifyPinBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { verifyAccountPin } from "../../../services/account-pin.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const verifyPinRoute = new Hono<AuthEnv>();

verifyPinRoute.use("*", createCategoryRateLimiter("authHeavy"));

verifyPinRoute.post("/", async (c) => {
  const body = await parseBody(c, VerifyPinBodySchema);
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await verifyAccountPin(db, auth.accountId, body, audit);
  return c.json(envelope(result));
});
