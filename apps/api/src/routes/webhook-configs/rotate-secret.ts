import { ID_PREFIXES } from "@pluralscape/types";
import { RotateWebhookSecretBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { rotateWebhookSecret } from "../../services/webhook-config/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const rotateSecretRoute = new Hono<AuthEnv>();

rotateSecretRoute.use("*", createCategoryRateLimiter("write"));

rotateSecretRoute.post("/:webhookId/rotate-secret", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const webhookId = parseIdParam(c.req.param("webhookId"), ID_PREFIXES.webhook);
  const audit = createAuditWriter(c, auth);
  const rawBody = await parseJsonBody(c);
  const parsed = RotateWebhookSecretBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const result = await rotateWebhookSecret(db, systemId, webhookId, parsed.data, auth, audit);
  c.header("Cache-Control", "no-store");
  return c.json(envelope(result));
});
