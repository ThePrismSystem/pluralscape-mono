import { ID_PREFIXES } from "@pluralscape/types";
import { IncludeArchivedQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { listBlobs } from "../../services/blob.service.js";

import { DEFAULT_BLOB_LIMIT, MAX_BLOB_LIMIT } from "./blobs.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.use("*", requireScopeMiddleware("read:blobs"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const { includeArchived } = IncludeArchivedQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
  });
  const limit = parsePaginationLimit(limitParam, DEFAULT_BLOB_LIMIT, MAX_BLOB_LIMIT);

  const db = await getDb();
  const result = await listBlobs(db, systemId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    includeArchived,
  });
  return c.json(result);
});
