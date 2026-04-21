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
import {
  ValidationError,
  commitRegistration,
  initiateRegistration,
} from "../../services/auth/register.js";

export const registerRoute = new Hono();

registerRoute.use("*", createCategoryRateLimiter("authHeavy"));

registerRoute.post("/initiate", async (c) => {
  const body = await parseJsonBody(c);
  const db = await getDb();

  const result = await initiateRegistration(db, body);
  return c.json(
    envelope({
      accountId: result.accountId,
      kdfSalt: result.kdfSalt,
      challengeNonce: result.challengeNonce,
    }),
    HTTP_CREATED,
  );
});

registerRoute.post("/commit", createIdempotencyMiddleware(), async (c) => {
  const body = await parseJsonBody(c);

  const platform = extractPlatform(c);
  const audit = createAuditWriter(c);
  const db = await getDb();

  try {
    const result = await commitRegistration(db, body, platform, audit);
    return c.json(
      envelope({
        sessionToken: result.sessionToken,
        accountId: result.accountId,
        accountType: result.accountType,
      }),
      HTTP_CREATED,
    );
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
});
