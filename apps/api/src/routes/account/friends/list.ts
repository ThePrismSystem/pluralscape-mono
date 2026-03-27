import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listFriendConnections } from "../../../services/friend-connection.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");

  const db = await getDb();
  const result = await listFriendConnections(db, auth.accountId, auth, {
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    includeArchived: c.req.query("includeArchived") === "true",
  });
  return c.json(result);
});
