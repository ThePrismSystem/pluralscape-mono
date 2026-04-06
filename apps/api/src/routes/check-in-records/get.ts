import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { getCheckInRecord } from "../../services/check-in-record.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.use("*", createCategoryRateLimiter("readDefault"));
getRoute.use("*", requireScopeMiddleware("read:check-ins"));

getRoute.get("/:recordId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const recordId = parseIdParam(c.req.param("recordId"), ID_PREFIXES.checkInRecord);

  const db = await getDb();
  const result = await getCheckInRecord(db, systemId, recordId, auth);
  return c.json(envelope(result));
});
