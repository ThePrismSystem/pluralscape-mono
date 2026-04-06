import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { parseAnalyticsQuery } from "../../services/analytics-query.service.js";
import { computeCoFrontingBreakdown } from "../../services/analytics.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const coFrontingAnalyticsRoute = new Hono<AuthEnv>();

coFrontingAnalyticsRoute.use("*", createCategoryRateLimiter("readDefault"));
coFrontingAnalyticsRoute.use("*", requireScopeMiddleware("read:reports"));

coFrontingAnalyticsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const dateRange = parseAnalyticsQuery(c.req.query());

  const db = await getDb();
  const result = await computeCoFrontingBreakdown(db, systemId, auth, dateRange);
  return c.json(envelope(result));
});
