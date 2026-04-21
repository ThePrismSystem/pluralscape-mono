import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getActiveFronting } from "../../services/fronting-session/queries.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const activeRoute = new Hono<AuthEnv>();

activeRoute.use("*", createCategoryRateLimiter("readDefault"));

activeRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);

  const db = await getDb();
  const result = await getActiveFronting(db, systemId, auth);
  return c.json(envelope(result));
});
