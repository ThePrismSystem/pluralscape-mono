import { RATE_LIMITS } from "@pluralscape/types";
import { Hono } from "hono";

import {
  HTTP_BAD_REQUEST,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
} from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { hashEmail } from "../../lib/email-hash.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { envelope } from "../../lib/response.js";
import { checkRateLimit, createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { NoActiveRecoveryKeyError } from "../../services/recovery-key/internal.js";
import { resetPasswordWithRecoveryKey } from "../../services/recovery-key/reset-password.js";

export const passwordResetRoute = new Hono();

passwordResetRoute.use("*", createCategoryRateLimiter("authHeavy"));

passwordResetRoute.post("/recovery-key", async (c) => {
  const body = await parseJsonBody(c);

  // Validate email presence — required for both the service call and rate limiting
  const email =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : undefined;
  if (typeof email !== "string") {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Email is required");
  }

  // Per-account rate limiting on recovery attempts (keyed by email hash)
  const emailHash = hashEmail(email);
  const { limit, windowMs } = RATE_LIMITS.recoveryAttempt;
  const rateCheck = await checkRateLimit(`recovery:${emailHash}`, limit, windowMs);
  if (!rateCheck.allowed) {
    throw new ApiHttpError(
      HTTP_TOO_MANY_REQUESTS,
      "RATE_LIMITED",
      "Too many recovery attempts for this account",
    );
  }

  const platform = extractPlatform(c);
  const audit = createAuditWriter(c);
  const db = await getDb();

  try {
    const result = await resetPasswordWithRecoveryKey(db, body, platform, audit);
    if (!result) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or recovery key");
    }

    return c.json(
      envelope({
        sessionToken: result.sessionToken,
        accountId: result.accountId,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof ApiHttpError) throw error;
    if (error instanceof NoActiveRecoveryKeyError) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or recovery key");
    }
    throw error;
  }
});
