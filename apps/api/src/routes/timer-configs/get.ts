import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { getTimerConfig } from "../../services/timer-config.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.use("*", createCategoryRateLimiter("readDefault"));
getRoute.use("*", requireScopeMiddleware("read:timers"));

getRoute.get("/:timerId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const timerId = parseIdParam(c.req.param("timerId"), ID_PREFIXES.timer);

  const db = await getDb();
  const result = await getTimerConfig(db, systemId, timerId, auth);
  return c.json(envelope(result));
});
