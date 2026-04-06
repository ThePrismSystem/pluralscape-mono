import { ID_PREFIXES } from "@pluralscape/types";
import { FrontingCommentQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listFrontingComments } from "../../../services/fronting-comment.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.use("*", requireScopeMiddleware("read:fronting"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sessionId = requireIdParam(
    c.req.param("sessionId"),
    "sessionId",
    ID_PREFIXES.frontingSession,
  );
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const query = FrontingCommentQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
  });

  const db = await getDb();
  const result = await listFrontingComments(db, systemId, sessionId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    includeArchived: query.includeArchived,
  });
  return c.json(result);
});
