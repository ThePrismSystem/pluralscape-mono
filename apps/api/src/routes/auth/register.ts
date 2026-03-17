import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { extractPlatform, extractRequestMeta } from "../../lib/request-meta.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ValidationError, registerAccount } from "../../services/auth.service.js";

export const registerRoute = new Hono();

registerRoute.use("*", createCategoryRateLimiter("authHeavy"));

registerRoute.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const platform = extractPlatform(c);
  const requestMeta = extractRequestMeta(c);

  const db = await getDb();

  try {
    const result = await registerAccount(db, body, platform, requestMeta);
    return c.json(
      {
        sessionToken: result.sessionToken,
        recoveryKey: result.recoveryKey,
        accountId: result.accountId,
        accountType: result.accountType,
      },
      HTTP_CREATED,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof Error && error.name === "ZodError") {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Invalid registration input",
        error,
      );
    }
    throw error;
  }
});
