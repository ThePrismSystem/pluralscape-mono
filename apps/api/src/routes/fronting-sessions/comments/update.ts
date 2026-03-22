import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateFrontingComment } from "../../../services/fronting-comment.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:commentId", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const commentId = parseIdParam(c.req.param("commentId"), ID_PREFIXES.frontingComment);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateFrontingComment(db, systemId, commentId, body, auth, audit);
  return c.json(result);
});
