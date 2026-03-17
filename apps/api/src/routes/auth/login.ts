import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_UNAUTHORIZED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { loginAccount } from "../../services/auth.service.js";

import { AUTH_GENERIC_LOGIN_ERROR } from "./auth.constants.js";

export const loginRoute = new Hono();

loginRoute.use("*", createCategoryRateLimiter("authHeavy"));

loginRoute.post("/", async (c) => {
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
    const result = await loginAccount(db, body, platform, audit);
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
