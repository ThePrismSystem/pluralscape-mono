import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { parseAnalyticsQuery } from "../../services/analytics-query.service.js";
import { computeFrontingBreakdown } from "../../services/analytics.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const frontingAnalyticsRoute = new Hono<AuthEnv>();

frontingAnalyticsRoute.use("*", createCategoryRateLimiter("readDefault"));

frontingAnalyticsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const dateRange = parseAnalyticsQuery(c.req.query());

  const db = await getDb();
  const result = await computeFrontingBreakdown(db, systemId, auth, dateRange);
  return c.json(envelope(result));
});
