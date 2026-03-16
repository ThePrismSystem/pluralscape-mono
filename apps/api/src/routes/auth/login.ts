import { Hono } from "hono";

import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  extractIpAddress,
  extractPlatform,
  extractUserAgent,
  loginAccount,
} from "../../services/auth.service.js";

import { AUTH_GENERIC_LOGIN_ERROR, HTTP_BAD_REQUEST, HTTP_UNAUTHORIZED } from "./auth.constants.js";

export const loginRoute = new Hono();

loginRoute.use("*", createCategoryRateLimiter("authHeavy"));

loginRoute.post("/", async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const platform = extractPlatform(c);
  const requestMeta = {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };

  const db = await getDb();

  try {
    const result = await loginAccount(db, body, platform, requestMeta);
    if (!result) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", AUTH_GENERIC_LOGIN_ERROR);
    }

    return c.json({
      sessionToken: result.sessionToken,
      accountId: result.accountId,
      systemId: result.systemId,
      accountType: result.accountType,
    });
  } catch (error) {
    if (error instanceof ApiHttpError) throw error;
    if (error instanceof Error && error.name === "ZodError") {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid login input", error);
    }
    throw error;
  }
});
