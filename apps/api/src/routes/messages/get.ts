import { ID_PREFIXES, type UnixMillis } from "@pluralscape/types";
import { MessageTimestampQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getMessage } from "../../services/message.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.use("*", createCategoryRateLimiter("readDefault"));

getRoute.get("/:messageId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const messageId = requireIdParam(c.req.param("messageId"), "messageId", ID_PREFIXES.message);
  const query = MessageTimestampQuerySchema.parse({
    timestamp: c.req.query("timestamp"),
  });

  const db = await getDb();
  const result = await getMessage(db, systemId, messageId, auth, {
    timestamp: query.timestamp as UnixMillis | undefined,
  });
  return c.json(result);
});
