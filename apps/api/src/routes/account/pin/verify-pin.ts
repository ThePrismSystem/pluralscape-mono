import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { verifyAccountPin } from "../../../services/account-pin.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const verifyPinRoute = new Hono<AuthEnv>();

verifyPinRoute.use("*", createCategoryRateLimiter("authHeavy"));

verifyPinRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await verifyAccountPin(db, auth.accountId, body, audit);
  return c.json(result);
});
