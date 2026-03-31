import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ValidationError, registerAccount } from "../../services/auth.service.js";

export const registerRoute = new Hono();

registerRoute.use("*", createCategoryRateLimiter("authHeavy"));
registerRoute.use("*", createIdempotencyMiddleware());

registerRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);

  const platform = extractPlatform(c);
  const audit = createAuditWriter(c);

  const db = await getDb();

  try {
    const result = await registerAccount(db, body, platform, audit);
    return c.json(
      envelope({
        sessionToken: result.sessionToken,
        recoveryKey: result.recoveryKey,
        accountId: result.accountId,
        accountType: result.accountType,
      }),
      HTTP_CREATED,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
});
