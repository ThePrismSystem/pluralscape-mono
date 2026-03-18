import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { getSubsystem } from "../../services/subsystem.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:subsystemId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const subsystemId = parseIdParam(c.req.param("subsystemId"), ID_PREFIXES.subsystem);

  const db = await getDb();
  const result = await getSubsystem(db, systemId, subsystemId, auth);
  return c.json(result);
});
