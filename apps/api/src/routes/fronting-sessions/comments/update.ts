import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateFrontingCommentBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateFrontingComment } from "../../../services/fronting-session/comments/update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:commentId", async (c) => {
  const body = await parseBody(c, UpdateFrontingCommentBodySchema);

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
  const result = await updateFrontingComment(db, systemId, sessionId, commentId, body, auth, audit);
  return c.json(envelope(result));
});
