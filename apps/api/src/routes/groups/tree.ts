import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { getGroupTree } from "../../services/group.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const treeRoute = new Hono<AuthEnv>();

treeRoute.get("/tree", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);

  const db = await getDb();
  const result = await getGroupTree(db, systemId, auth);
  return c.json(result);
});
