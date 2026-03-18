import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { listAllMemberMemberships } from "../../services/member.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const membershipsRoute = new Hono<AuthEnv>();

membershipsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const memberId = parseIdParam(c.req.param("memberId") as string, ID_PREFIXES.member);

  const db = await getDb();
  const result = await listAllMemberMemberships(db, systemId, memberId, auth);
  return c.json(result);
});
