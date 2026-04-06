import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { fromCompositeCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import {
  DEFAULT_PHOTO_LIMIT,
  listMemberPhotos,
  MAX_PHOTO_LIMIT,
} from "../../../services/member-photo.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.use("*", requireScopeMiddleware("read:members"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const memberId = requireIdParam(c.req.param("memberId"), "memberId", ID_PREFIXES.member);

  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PHOTO_LIMIT, MAX_PHOTO_LIMIT);
  const cursor = cursorParam ? fromCompositeCursor(cursorParam, "photo") : undefined;

  const db = await getDb();
  const result = await listMemberPhotos(db, systemId, memberId, auth, { cursor, limit });
  return c.json(result);
});
