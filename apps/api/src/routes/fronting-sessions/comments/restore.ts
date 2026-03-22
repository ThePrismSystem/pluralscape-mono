import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { restoreFrontingComment } from "../../../services/fronting-comment.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));

restoreRoute.post("/:commentId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sessionId = requireIdParam(
    c.req.param("sessionId"),
    "sessionId",
    ID_PREFIXES.frontingSession,
  );
  const commentId = parseIdParam(c.req.param("commentId"), ID_PREFIXES.frontingComment);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreFrontingComment(db, systemId, sessionId, commentId, auth, audit);
  return c.json(result);
});
