import { BiometricEnrollBodySchema, BiometricVerifyBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { enrollBiometric, verifyBiometric } from "../../services/biometric.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const biometricRoute = new Hono<AuthEnv>();

biometricRoute.use("*", authMiddleware());
biometricRoute.use("*", createCategoryRateLimiter("authHeavy"));

biometricRoute.post("/enroll", createIdempotencyMiddleware(), async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = BiometricEnrollBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const db = await getDb();

  const result = await enrollBiometric(db, parsed.data, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});

biometricRoute.post("/verify", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = BiometricVerifyBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const db = await getDb();

  const result = await verifyBiometric(db, parsed.data, auth, audit);
  return c.json(envelope(result));
});
