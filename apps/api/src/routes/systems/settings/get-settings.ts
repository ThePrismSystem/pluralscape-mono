import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getSystemSettings } from "../../../services/system-settings.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const getSettingsRoute = new Hono<AuthEnv>();

getSettingsRoute.use("*", createCategoryRateLimiter("readDefault"));
getSettingsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);

  const db = await getDb();
  const result = await getSystemSettings(db, systemId, auth);
  return c.json(result);
});
