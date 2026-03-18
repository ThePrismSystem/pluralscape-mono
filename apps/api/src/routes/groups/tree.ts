import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getGroupTree } from "../../services/group.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const treeRoute = new Hono<AuthEnv>();

treeRoute.use("*", createCategoryRateLimiter("readHeavy"));

treeRoute.get("/tree", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);

  const db = await getDb();
  const result = await getGroupTree(db, systemId, auth);
  return c.json(result);
});
