import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listLifecycleEvents } from "../../services/lifecycle-event.service.js";

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
  const eventType = c.req.query("eventType");

  const db = await getDb();
  const result = await listLifecycleEvents(
    db,
    systemId,
    auth,
    cursorParam ?? undefined,
    limit,
    eventType,
  );
  return c.json(result);
});
