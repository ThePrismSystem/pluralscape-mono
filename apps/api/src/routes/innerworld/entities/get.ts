import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { getEntity } from "../../../services/innerworld-entity.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:entityId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const entityId = parseIdParam(c.req.param("entityId"), ID_PREFIXES.innerWorldEntity);

  const db = await getDb();
  const result = await getEntity(db, systemId, entityId, auth);
  return c.json(result);
});
