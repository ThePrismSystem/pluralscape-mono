import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { restoreMessage } from "../../services/message.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));
restoreRoute.use("*", requireScopeMiddleware("write:messages"));

restoreRoute.post("/:messageId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const messageId = requireIdParam(c.req.param("messageId"), "messageId", ID_PREFIXES.message);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreMessage(db, systemId, messageId, auth, audit);
  return c.json(envelope(result));
});
