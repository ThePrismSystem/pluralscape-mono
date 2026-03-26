import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listNotes, parseNoteQuery } from "../../services/note.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const query = parseNoteQuery({
    includeArchived: c.req.query("includeArchived"),
    authorEntityType: c.req.query("authorEntityType"),
    authorEntityId: c.req.query("authorEntityId"),
    systemWide: c.req.query("systemWide"),
  });

  const db = await getDb();
  const result = await listNotes(db, systemId, auth, {
    cursor: c.req.query("cursor"),
    limit,
    includeArchived: query.includeArchived,
    authorEntityType: query.authorEntityType,
    authorEntityId: query.authorEntityId,
    systemWide: query.systemWide,
  });
  return c.json(result);
});
