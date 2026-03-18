import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { listFieldValues } from "../../../services/field-value.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const memberId = requireIdParam(c.req.param("memberId"), "memberId", ID_PREFIXES.member);

  const db = await getDb();
  const result = await listFieldValues(db, systemId, memberId, auth);
  return c.json({ items: result });
});
