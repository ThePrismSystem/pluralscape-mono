import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam } from "../../../lib/id-param.js";
import { listGroupMembers } from "../../../services/group-membership.service.js";
import { DEFAULT_GROUP_LIMIT, MAX_GROUP_LIMIT } from "../groups.constants.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const groupId = parseIdParam(c.req.param("groupId") ?? "", ID_PREFIXES.group);
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const parsed = limitParam ? parseInt(limitParam, 10) : DEFAULT_GROUP_LIMIT;
  const limit =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_GROUP_LIMIT) : DEFAULT_GROUP_LIMIT;

  const db = await getDb();
  const result = await listGroupMembers(
    db,
    systemId,
    groupId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
  );
  return c.json(result);
});
