import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getEntityHierarchy } from "../../../services/structure/association.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const hierarchyRoute = new Hono<AuthEnv>();

hierarchyRoute.use("*", createCategoryRateLimiter("readDefault"));

hierarchyRoute.get("/:entityId/hierarchy", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const entityId = parseIdParam(c.req.param("entityId"), ID_PREFIXES.structureEntity);

  const db = await getDb();
  const result = await getEntityHierarchy(db, systemId, entityId, auth);
  return c.json(envelope(result));
});
