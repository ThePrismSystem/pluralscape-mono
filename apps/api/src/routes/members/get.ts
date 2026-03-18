import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { getMember } from "../../services/member.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:memberId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const memberId = parseIdParam(c.req.param("memberId"), ID_PREFIXES.member);

  const db = await getDb();
  const result = await getMember(db, systemId, memberId, auth);
  return c.json(result);
});
