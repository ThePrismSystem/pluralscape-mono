import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam } from "../../../lib/id-param.js";
import { parsePaginationLimit } from "../../../lib/pagination.js";
import { listRegions } from "../../../services/innerworld-region.service.js";

import { DEFAULT_REGION_LIMIT, MAX_REGION_LIMIT } from "./regions.constants.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_REGION_LIMIT, MAX_REGION_LIMIT);
  const includeArchived = c.req.query("includeArchived") === "true";

  const db = await getDb();
  const result = await listRegions(db, systemId, auth, {
    cursor: cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    includeArchived,
  });
  return c.json(result);
});
