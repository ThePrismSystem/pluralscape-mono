import { RegenerateRecoveryKeySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { getQueue } from "../../lib/queue.js";
import { envelope } from "../../lib/response.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ValidationError } from "../../services/auth/register.js";
import { NoActiveRecoveryKeyError } from "../../services/recovery-key/internal.js";
import { regenerateRecoveryKeyBackup } from "../../services/recovery-key/regenerate.js";
import { getRecoveryKeyStatus } from "../../services/recovery-key/status.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const recoveryKeyRoutes = new Hono<AuthEnv>();
recoveryKeyRoutes.use("*", authMiddleware());

recoveryKeyRoutes.get("/status", createCategoryRateLimiter("authLight"), async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const result = await getRecoveryKeyStatus(db, auth.accountId);
  return c.json(envelope(result));
});

recoveryKeyRoutes.post(
  "/regenerate",
  createCategoryRateLimiter("authHeavy"),
  createIdempotencyMiddleware(),
  async (c) => {
    const auth = c.get("auth");
    const db = await getDb();

    const rawBody = await parseJsonBody(c);
    const parsed = RegenerateRecoveryKeySchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Invalid request body",
        parsed.error.issues,
      );
    }

    const audit = createAuditWriter(c, auth);

    try {
      const result = await regenerateRecoveryKeyBackup(db, auth.accountId, parsed.data, audit);

      // Fire-and-forget: enqueue recovery-key-regenerated email notification
      const queue = getQueue();
      if (queue) {
        queue
          .enqueue({
            type: "email-send",
            systemId: null,
            payload: {
              accountId: auth.accountId,
              template: "recovery-key-regenerated",
              vars: {
                timestamp: new Date().toISOString(),
                deviceInfo: c.req.header("user-agent") ?? "Unknown device",
              },
              recipientOverride: null,
            },
            idempotencyKey: `email:recovery-key-regen:${auth.accountId}:${String(Date.now())}`,
          })
          .catch((err: unknown) => {
            logger.warn("[recovery-key] failed to enqueue email notification", {
              accountId: auth.accountId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }

      return c.json(envelope(result), HTTP_CREATED);
    } catch (error: unknown) {
      if (error instanceof NoActiveRecoveryKeyError) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", error.message);
      }
      if (error instanceof ValidationError) {
        throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
      }
      if (error instanceof Error && error.name === "ZodError") {
        throw new ApiHttpError(
          HTTP_BAD_REQUEST,
          "VALIDATION_ERROR",
          "Invalid recovery key input",
          error,
        );
      }
      throw error;
    }
  },
);
