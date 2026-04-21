import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { deleteFrontingComment } from "../../../services/fronting-session/comments/lifecycle.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:commentId", async (c) => {
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
  await deleteFrontingComment(db, systemId, sessionId, commentId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
