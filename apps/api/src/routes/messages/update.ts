import { ID_PREFIXES } from "@pluralscape/types";
import { MessageTimestampQuerySchema, UpdateMessageBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateMessage } from "../../services/message/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:messageId", async (c) => {
  const body = await parseBody(c, UpdateMessageBodySchema);

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
