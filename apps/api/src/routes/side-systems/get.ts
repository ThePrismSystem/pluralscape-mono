import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { getSideSystem } from "../../services/side-system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:sideSystemId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sideSystemId = parseIdParam(c.req.param("sideSystemId"), ID_PREFIXES.sideSystem);

  const db = await getDb();
  const result = await getSideSystem(db, systemId, sideSystemId, auth);
  return c.json(result);
});
