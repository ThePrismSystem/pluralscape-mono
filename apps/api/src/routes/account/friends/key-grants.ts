import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listReceivedKeyGrants } from "../../../services/key-grant.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const keyGrantsRoute = new Hono<AuthEnv>();

keyGrantsRoute.use("*", createCategoryRateLimiter("readDefault"));

keyGrantsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const result = await listReceivedKeyGrants(db, auth.accountId);
  return c.json(envelope(result));
});
