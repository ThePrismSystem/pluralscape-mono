import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listRelationships } from "../../services/relationship.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const memberId = c.req.query("memberId");

  const db = await getDb();
  const result = await listRelationships(
    db,
    systemId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    memberId,
  );
  return c.json(result);
});
