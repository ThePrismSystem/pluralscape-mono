import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getRegion } from "../../../services/innerworld-region.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.use("*", createCategoryRateLimiter("readDefault"));
getRoute.get("/:regionId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const regionId = parseIdParam(c.req.param("regionId"), ID_PREFIXES.innerWorldRegion);

  const db = await getDb();
  const result = await getRegion(db, systemId, regionId, auth);
  return c.json(envelope(result));
});
