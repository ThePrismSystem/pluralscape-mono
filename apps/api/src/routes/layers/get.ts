import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { getLayer } from "../../services/layer.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:layerId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const layerId = parseIdParam(c.req.param("layerId"), ID_PREFIXES.layer);

  const db = await getDb();
  const result = await getLayer(db, systemId, layerId, auth);
  return c.json(result);
});
