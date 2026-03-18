import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { enrollBiometric, verifyBiometric } from "../../services/biometric.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const biometricRoute = new Hono<AuthEnv>();

biometricRoute.use("*", authMiddleware());
biometricRoute.use("*", createCategoryRateLimiter("authHeavy"));

biometricRoute.post("/enroll", async (c) => {
  const body = await parseJsonBody(c);

  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const db = await getDb();

  const result = await enrollBiometric(db, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});

biometricRoute.post("/verify", async (c) => {
  const body = await parseJsonBody(c);

  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const db = await getDb();

  const result = await verifyBiometric(db, body, auth, audit);
  return c.json(result);
});
