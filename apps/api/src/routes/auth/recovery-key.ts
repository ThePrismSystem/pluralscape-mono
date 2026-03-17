import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ValidationError } from "../../services/auth.service.js";
import {
  NoActiveRecoveryKeyError,
  getRecoveryKeyStatus,
  regenerateRecoveryKeyBackup,
} from "../../services/recovery-key.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const recoveryKeyRoutes = new Hono<AuthEnv>();
recoveryKeyRoutes.use("*", authMiddleware());

recoveryKeyRoutes.get("/status", createCategoryRateLimiter("authLight"), async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const result = await getRecoveryKeyStatus(db, auth.accountId);
  return c.json(result);
});

recoveryKeyRoutes.post("/regenerate", createCategoryRateLimiter("authHeavy"), async (c) => {
  const auth = c.get("auth");
  const db = await getDb();

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const audit = createAuditWriter(c, auth);

  try {
    const result = await regenerateRecoveryKeyBackup(db, auth.accountId, body, audit);
    return c.json(result, HTTP_CREATED);
  } catch (error: unknown) {
    if (error instanceof NoActiveRecoveryKeyError) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", error.message);
    }
    if (error instanceof ValidationError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    if (error instanceof Error && error.name === "ZodError") {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "VALIDATION_ERROR",
        "Invalid recovery key input",
        error,
      );
    }
    throw error;
  }
});
