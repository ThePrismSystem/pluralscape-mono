import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { getSystemProfile } from "../../services/system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:id", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam<"SystemId">(c.req.param("id"), "sys_") as SystemId;

  const db = await getDb();
  const result = await getSystemProfile(db, systemId, auth);
  return c.json(result);
});
