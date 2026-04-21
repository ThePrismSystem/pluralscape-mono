import { ID_PREFIXES } from "@pluralscape/types";
import { MessageQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listMessages } from "../../services/message/queries.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const channelId = requireIdParam(c.req.param("channelId"), "channelId", ID_PREFIXES.channel);
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const query = MessageQuerySchema.parse({
    before: c.req.query("before"),
    after: c.req.query("after"),
    includeArchived: c.req.query("includeArchived"),
  });

  const db = await getDb();
  const result = await listMessages(db, systemId, channelId, auth, {
    cursor: c.req.query("cursor"),
    limit,
    before: query.before,
    after: query.after,
    includeArchived: query.includeArchived,
  });
  return c.json(result);
});
