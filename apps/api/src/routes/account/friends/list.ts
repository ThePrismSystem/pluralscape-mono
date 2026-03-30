import { FRIEND_CONNECTION_STATUSES } from "@pluralscape/db";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listFriendConnections } from "../../../services/friend-connection.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";
import type { FriendConnectionStatus } from "@pluralscape/types";

const VALID_STATUSES: ReadonlySet<string> = new Set(FRIEND_CONNECTION_STATUSES);

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");

  const statusParam = c.req.query("status");
  const status =
    statusParam && VALID_STATUSES.has(statusParam)
      ? (statusParam as FriendConnectionStatus)
      : undefined;

  const db = await getDb();
  const result = await listFriendConnections(db, auth.accountId, auth, {
    cursor: c.req.query("cursor"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
    includeArchived: c.req.query("includeArchived") === "true",
    status,
  });
  return c.json(result);
});
