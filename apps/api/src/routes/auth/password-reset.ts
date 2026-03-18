import { Hono } from "hono";

import { HTTP_UNAUTHORIZED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  DecryptionFailedError,
  InvalidInputError,
  NoActiveRecoveryKeyError,
  resetPasswordWithRecoveryKey,
} from "../../services/recovery-key.service.js";

export const passwordResetRoute = new Hono();

passwordResetRoute.use("*", createCategoryRateLimiter("authHeavy"));

passwordResetRoute.post("/recovery-key", async (c) => {
  const body = await parseJsonBody(c);

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
    if (
      error instanceof NoActiveRecoveryKeyError ||
      error instanceof DecryptionFailedError ||
      error instanceof InvalidInputError
    ) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or recovery key");
    }
    throw error;
  }
});
