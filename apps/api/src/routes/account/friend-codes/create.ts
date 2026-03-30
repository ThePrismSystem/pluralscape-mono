import { Hono } from "hono";

import { HTTP_CREATED } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { generateFriendCode } from "../../../services/friend-code.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const createRoute = new Hono<AuthEnv>();

createRoute.use("*", createCategoryRateLimiter("write"));

createRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await generateFriendCode(db, auth.accountId, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
