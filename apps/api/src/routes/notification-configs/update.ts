import { NOTIFICATION_EVENT_TYPES } from "@pluralscape/db";
import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateNotificationConfigBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam, requireParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateNotificationConfig } from "../../services/notification-config.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { NotificationEventType } from "@pluralscape/types";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.patch("/:eventType", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);

  const rawEventType = requireParam(c.req.param("eventType"), "eventType");
  if (!NOTIFICATION_EVENT_TYPES.includes(rawEventType as NotificationEventType)) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      `Invalid event type: ${rawEventType}`,
    );
  }
  const eventType = rawEventType as NotificationEventType;

  const body = await parseJsonBody(c);
  const parsed = UpdateNotificationConfigBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();

  const result = await updateNotificationConfig(db, systemId, eventType, parsed.data, auth, audit);
  return c.json(result);
});
