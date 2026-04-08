import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_OK } from "../../../http.constants.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listImportEntityRefs } from "../../../services/import-entity-ref.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";
import type { ImportEntityType, ImportSource } from "@pluralscape/types";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursor = parseCursor(c.req.query("cursor"));
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const source = c.req.query("source") as ImportSource | undefined;
  const entityType = c.req.query("entityType") as ImportEntityType | undefined;
  const sourceEntityId = c.req.query("sourceEntityId");

  const db = await getDb();
  const result = await listImportEntityRefs(db, systemId, auth, {
    cursor,
    limit,
    source,
    entityType,
    sourceEntityId,
  });
  return c.json(result, HTTP_OK);
});
