import { ID_PREFIXES } from "@pluralscape/types";
import { CreateFrontingSessionBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { getQueue } from "../../lib/queue.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { createFrontingSession } from "../../services/fronting-session/create.js";
import { dispatchSwitchAlertForSession } from "../../services/switch-alert-dispatcher.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const createRoute = new Hono<AuthEnv>();

createRoute.use("*", createCategoryRateLimiter("write"));
createRoute.use("*", createIdempotencyMiddleware());

createRoute.post("/", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = CreateFrontingSessionBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await createFrontingSession(db, systemId, parsed.data, auth, audit);

  const queue = getQueue();
  if (queue) {
    void dispatchSwitchAlertForSession(
      db,
      systemId,
      result.id,
      result.memberId ?? null,
      result.customFrontId ?? null,
      queue,
    );
  }

  return c.json(envelope(result), HTTP_CREATED);
});
