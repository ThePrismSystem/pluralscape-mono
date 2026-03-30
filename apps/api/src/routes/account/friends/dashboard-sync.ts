import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getFriendDashboardSync } from "../../../services/friend-dashboard-sync.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const dashboardSyncRoute = new Hono<AuthEnv>();

dashboardSyncRoute.use("*", createCategoryRateLimiter("readDefault"));

dashboardSyncRoute.get("/:connectionId/dashboard/sync", async (c) => {
  const auth = c.get("auth");
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );

  const db = await getDb();
  const result = await getFriendDashboardSync(db, connectionId, auth);
  return c.json(envelope(result));
});
