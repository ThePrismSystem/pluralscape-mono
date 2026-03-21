import { ID_PREFIXES } from "@pluralscape/types";
import { LifecycleEventQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listLifecycleEvents } from "../../services/lifecycle-event.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const { eventType } = LifecycleEventQuerySchema.parse({
    eventType: c.req.query("eventType"),
  });

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
