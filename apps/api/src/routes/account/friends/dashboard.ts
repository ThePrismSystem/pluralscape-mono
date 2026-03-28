import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getFriendDashboard } from "../../../services/friend-dashboard.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const dashboardRoute = new Hono<AuthEnv>();

dashboardRoute.use("*", createCategoryRateLimiter("readDefault"));

dashboardRoute.get("/:connectionId/dashboard", async (c) => {
  const auth = c.get("auth");
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );

  const db = await getDb();
  const result = await getFriendDashboard(db, connectionId, auth);
  return c.json(result);
});
