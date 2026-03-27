import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateFriendNotificationPreferenceBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../../http.constants.js";
import { ApiHttpError } from "../../../../lib/api-error.js";
import { createAuditWriter } from "../../../../lib/audit-writer.js";
import { getDb } from "../../../../lib/db.js";
import { requireIdParam } from "../../../../lib/id-param.js";
import { parseJsonBody } from "../../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../../middleware/rate-limit.js";
import { updateFriendNotificationPreference } from "../../../../services/friend-notification-preference.service.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.patch("/", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );

  const body = await parseJsonBody(c);
  const parsed = UpdateFriendNotificationPreferenceBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const result = await updateFriendNotificationPreference(
    db,
    auth.accountId,
    connectionId,
    parsed.data,
    auth,
    audit,
  );
  return c.json(result);
});
