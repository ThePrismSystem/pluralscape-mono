import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ConcurrencyError, changeEmail } from "../../services/account.service.js";
import { ValidationError } from "../../services/auth.service.js";

import { EMAIL_CHANGE_FAILED_ERROR } from "./account.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const changeEmailRoute = new Hono<AuthEnv>();
changeEmailRoute.use("*", createCategoryRateLimiter("authHeavy"));

changeEmailRoute.put("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const body: unknown = await c.req.json();
  const audit = createAuditWriter(c, auth);

  try {
    const result = await changeEmail(db, auth.accountId, body, audit);
    return c.json(result);
  } catch (error: unknown) {
    if (error instanceof ConcurrencyError) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", error.message);
    }
    if (error instanceof ValidationError) {
      const status = error.message === EMAIL_CHANGE_FAILED_ERROR ? HTTP_CONFLICT : HTTP_BAD_REQUEST;
      const code = error.message === EMAIL_CHANGE_FAILED_ERROR ? "CONFLICT" : "VALIDATION_ERROR";
      throw new ApiHttpError(status, code, error.message);
    }
    throw error;
  }
});
