import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { testWebhookConfig } from "../../services/webhook-config/test.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const testRoute = new Hono<AuthEnv>();

testRoute.use("*", createCategoryRateLimiter("write"));

testRoute.post("/:webhookId/test", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const webhookId = parseIdParam(c.req.param("webhookId"), ID_PREFIXES.webhook);

  const db = await getDb();
  const result = await testWebhookConfig(db, systemId, webhookId, auth);
  return c.json(envelope(result));
});
