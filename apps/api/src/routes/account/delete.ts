import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { deleteAccount } from "../../services/account-deletion.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const db = await getDb();
  await deleteAccount(db, body, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
