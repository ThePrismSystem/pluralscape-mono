import { FRIEND_CONNECTION_STATUSES } from "@pluralscape/db";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listFriendConnections } from "../../../services/friend-connection.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";
import type { FriendConnectionStatus } from "@pluralscape/types";

const VALID_STATUSES = new Set<string>(FRIEND_CONNECTION_STATUSES);

function isFriendConnectionStatus(s: string): s is FriendConnectionStatus {
  return VALID_STATUSES.has(s);
}

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");

  const statusParam = c.req.query("status");
  const status = statusParam && isFriendConnectionStatus(statusParam) ? statusParam : undefined;

  const db = await getDb();
  const result = await listFriendConnections(db, auth.accountId, auth, {
    cursor: c.req.query("cursor"),
    limit: parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT),
    includeArchived: c.req.query("includeArchived") === "true",
    status,
  });
  return c.json(result);
});
