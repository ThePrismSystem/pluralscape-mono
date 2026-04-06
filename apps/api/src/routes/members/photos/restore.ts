import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { restoreMemberPhoto } from "../../../services/member-photo.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));
restoreRoute.use("*", requireScopeMiddleware("write:members"));

restoreRoute.post("/:photoId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const memberId = requireIdParam(c.req.param("memberId"), "memberId", ID_PREFIXES.member);
  const photoId = parseIdParam(c.req.param("photoId"), ID_PREFIXES.memberPhoto);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreMemberPhoto(db, systemId, memberId, photoId, auth, audit);
  return c.json(envelope(result));
});
