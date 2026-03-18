import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { listMembers } from "../../services/member.service.js";

import { DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT } from "./members.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const includeArchived = c.req.query("include_archived") === "true";
  const parsed = limitParam ? parseInt(limitParam, 10) : DEFAULT_MEMBER_LIMIT;
  const limit =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, MAX_MEMBER_LIMIT)
      : DEFAULT_MEMBER_LIMIT;

  const db = await getDb();
  const result = await listMembers(db, systemId, auth, {
    cursor: cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    includeArchived,
  });
  return c.json(result);
});
