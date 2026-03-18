import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { parsePaginationLimit } from "../../../lib/pagination.js";
import { listEntities } from "../../../services/innerworld-entity.service.js";

import { DEFAULT_ENTITY_LIMIT, MAX_ENTITY_LIMIT } from "./entities.constants.js";

import type { AuthEnv } from "../../../lib/auth-context.js";
import type { InnerWorldRegionId } from "@pluralscape/types";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_ENTITY_LIMIT, MAX_ENTITY_LIMIT);
  const regionId = c.req.query("regionId") as InnerWorldRegionId | undefined;
  const includeArchived = c.req.query("includeArchived") === "true";

  const db = await getDb();
  const result = await listEntities(db, systemId, auth, {
    cursor: cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    regionId,
    includeArchived,
  });
  return c.json(result);
});
