import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { wrapAction } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { setAccountPin } from "../../../services/account-pin.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const setPinRoute = new Hono<AuthEnv>();

setPinRoute.use("*", createCategoryRateLimiter("authHeavy"));

setPinRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await setAccountPin(db, auth.accountId, body, audit);
  return c.json(wrapAction());
});
