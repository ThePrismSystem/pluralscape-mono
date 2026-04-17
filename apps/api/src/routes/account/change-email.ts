import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { logger } from "../../lib/logger.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { getQueue } from "../../lib/queue.js";
import { extractIpAddress } from "../../lib/request-meta.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ConcurrencyError, changeEmail } from "../../services/account.service.js";
import { ValidationError } from "../../services/auth.service.js";

import { EMAIL_CHANGE_FAILED_ERROR } from "./account.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const changeEmailRoute = new Hono<AuthEnv>();
changeEmailRoute.use("*", createCategoryRateLimiter("authHeavy"));

changeEmailRoute.put("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const body = await parseJsonBody(c);
  const audit = createAuditWriter(c, auth);
  const ipAddress = extractIpAddress(c);

  try {
    const result = await changeEmail(db, auth.accountId, body, audit);

    // Fire-and-forget: notify the OLD email address about the change.
    // Skipped when:
    //   - result.oldEmail is null (no-op change, or encrypted email not resolvable)
    //   - the queue is disabled (local dev without Valkey)
    // `recipientOverride` sends to the prior address explicitly — by the time
    // the worker runs, the account's encryptedEmail may already reflect the
    // new address, so we cannot rely on resolveAccountEmail inside the worker.
    if (result.oldEmail && result.newEmail) {
      const queue = getQueue();
      if (queue) {
        queue
          .enqueue({
            type: "email-send",
            systemId: null,
            payload: {
              accountId: auth.accountId,
              template: "account-change-email",
              vars: {
                oldEmail: result.oldEmail,
                newEmail: result.newEmail,
                timestamp: new Date().toISOString(),
                ...(ipAddress ? { ipAddress } : {}),
              },
              recipientOverride: result.oldEmail,
            },
            idempotencyKey: `email:account-change:${auth.accountId}:${String(Date.now())}`,
          })
          .catch((err: unknown) => {
            logger.warn("[change-email] failed to enqueue notification to old address", {
              accountId: auth.accountId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
    }

    // Return the ok flag only — callers do not need the resolved addresses
    // (they know the new address; the old address is intentionally private).
    return c.json(envelope({ ok: true as const }));
  } catch (error: unknown) {
    if (error instanceof ConcurrencyError) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", error.message);
    }
    if (error instanceof ValidationError) {
      const status = error.message === EMAIL_CHANGE_FAILED_ERROR ? HTTP_CONFLICT : HTTP_BAD_REQUEST;
      const code = error.message === EMAIL_CHANGE_FAILED_ERROR ? "CONFLICT" : "VALIDATION_ERROR";
      throw new ApiHttpError(status, code, error.message);
    }
    throw error;
  }
});
