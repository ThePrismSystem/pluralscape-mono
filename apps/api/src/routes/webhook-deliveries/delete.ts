import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { deleteWebhookDelivery } from "../../services/webhook-delivery.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:deliveryId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const deliveryId = parseIdParam(c.req.param("deliveryId"), ID_PREFIXES.webhookDelivery);

  const db = await getDb();
  await deleteWebhookDelivery(db, systemId, deliveryId, auth);
  return c.body(null, HTTP_NO_CONTENT);
});
