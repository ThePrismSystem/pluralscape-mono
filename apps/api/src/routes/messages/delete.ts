import { ID_PREFIXES } from "@pluralscape/types";
import { MessageTimestampQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { deleteMessage } from "../../services/message/delete.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:messageId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const messageId = requireIdParam(c.req.param("messageId"), "messageId", ID_PREFIXES.message);
  const audit = createAuditWriter(c, auth);
  const query = MessageTimestampQuerySchema.parse({
    timestamp: c.req.query("timestamp"),
  });

  const db = await getDb();
  await deleteMessage(db, systemId, messageId, auth, audit, {
    timestamp: query.timestamp,
  });
  return c.body(null, HTTP_NO_CONTENT);
});
