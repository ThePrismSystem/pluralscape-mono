import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { getGroup } from "../../services/group.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:groupId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const groupId = parseIdParam(c.req.param("groupId"), ID_PREFIXES.group);

  const db = await getDb();
  const result = await getGroup(db, systemId, groupId, auth);
  return c.json(result);
});
