import { Hono } from "hono";

import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  type RegisterParams,
  ValidationError,
  extractIpAddress,
  extractPlatform,
  extractUserAgent,
  registerAccount,
} from "../../services/auth.service.js";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "./auth.constants.js";

export const registerRoute = new Hono();

registerRoute.use("*", createCategoryRateLimiter("authHeavy"));

registerRoute.post("/", async (c) => {
  let body: RegisterParams;
  try {
    body = await c.req.json<RegisterParams>();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const platform = extractPlatform(c);
  const requestMeta = {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };

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
