import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { extractRequestMeta } from "../../lib/request-meta.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ConcurrencyError, changePassword } from "../../services/account.service.js";
import { ValidationError } from "../../services/auth.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const changePasswordRoute = new Hono<AuthEnv>();
changePasswordRoute.use("*", createCategoryRateLimiter("authHeavy"));

changePasswordRoute.put("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const body: unknown = await c.req.json();
  const requestMeta = extractRequestMeta(c);

  try {
    const result = await changePassword(db, auth.accountId, auth.sessionId, body, requestMeta);
    return c.json(result);
  } catch (error: unknown) {
    if (error instanceof ConcurrencyError) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", error.message);
    }
    if (error instanceof ValidationError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
});
