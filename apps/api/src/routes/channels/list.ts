import { ID_PREFIXES } from "@pluralscape/types";
import { ChannelQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listChannels } from "../../services/channel/queries.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const query = ChannelQuerySchema.parse({
    type: c.req.query("type"),
    parentId: c.req.query("parentId"),
    includeArchived: c.req.query("includeArchived"),
  });

  const db = await getDb();
  const result = await listChannels(db, systemId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    type: query.type,
    parentId: query.parentId,
    includeArchived: query.includeArchived,
  });
  return c.json(result);
});
