import { BiometricEnrollBodySchema, BiometricVerifyBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
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
  const body = await parseBody(c, BiometricEnrollBodySchema);

  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const db = await getDb();

  const result = await enrollBiometric(db, body, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});

biometricRoute.post("/verify", async (c) => {
  const body = await parseBody(c, BiometricVerifyBodySchema);

  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const db = await getDb();

  const result = await verifyBiometric(db, body, auth, audit);
  return c.json(envelope(result));
});
