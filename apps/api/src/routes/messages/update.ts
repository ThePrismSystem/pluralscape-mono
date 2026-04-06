import { ID_PREFIXES } from "@pluralscape/types";
import { MessageTimestampQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { updateMessage } from "../../services/message.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));
updateRoute.use("*", requireScopeMiddleware("write:messages"));

updateRoute.put("/:messageId", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const messageId = requireIdParam(c.req.param("messageId"), "messageId", ID_PREFIXES.message);
  const audit = createAuditWriter(c, auth);
  const query = MessageTimestampQuerySchema.parse({
    timestamp: c.req.query("timestamp"),
  });

  const db = await getDb();
  const result = await updateMessage(db, systemId, messageId, body, auth, audit, {
    timestamp: query.timestamp,
  });
  return c.json(envelope(result));
});
