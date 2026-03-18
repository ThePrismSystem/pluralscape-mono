import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_UNAUTHORIZED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  NoActiveRecoveryKeyError,
  resetPasswordWithRecoveryKey,
} from "../../services/recovery-key.service.js";

export const passwordResetRoute = new Hono();

passwordResetRoute.use("*", createCategoryRateLimiter("authHeavy"));

passwordResetRoute.post("/recovery-key", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const platform = extractPlatform(c);
  const audit = createAuditWriter(c);
  const db = await getDb();

  try {
    const result = await resetPasswordWithRecoveryKey(db, body, platform, audit);
    if (!result) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or recovery key");
    }

    return c.json({
      sessionToken: result.sessionToken,
      recoveryKey: result.recoveryKey,
      accountId: result.accountId,
    });
  } catch (error) {
    if (error instanceof ApiHttpError) throw error;
    if (error instanceof NoActiveRecoveryKeyError) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or recovery key");
    }
    if (error instanceof Error && error.name === "ZodError") {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Invalid password reset input",
        error,
      );
    }
    // Crypto errors (bad recovery key) should return 401
    if (error instanceof Error && error.message.includes("decrypt")) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or recovery key");
    }
    throw error;
  }
});
