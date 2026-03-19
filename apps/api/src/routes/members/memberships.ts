import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { listAllMemberMemberships } from "../../services/member.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const membershipsRoute = new Hono<AuthEnv>();

membershipsRoute.use("*", createCategoryRateLimiter("readDefault"));

membershipsRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const memberId = requireIdParam(c.req.param("memberId"), "memberId", ID_PREFIXES.member);

  const db = await getDb();
  const result = await listAllMemberMemberships(db, systemId, memberId, auth);
  return c.json(result);
});
