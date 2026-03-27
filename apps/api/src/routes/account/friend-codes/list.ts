import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listFriendCodes } from "../../../services/friend-code.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");

  const db = await getDb();
  const result = await listFriendCodes(db, auth.accountId, auth);
  return c.json({ data: result });
});
