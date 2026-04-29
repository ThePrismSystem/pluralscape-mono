import { VerifyPinBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { verifyAccountPin } from "../../../services/account-pin.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const verifyPinRoute = new Hono<AuthEnv>();

verifyPinRoute.use("*", createCategoryRateLimiter("authHeavy"));

verifyPinRoute.post("/", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = VerifyPinBodySchema.safeParse(rawBody);
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
  const result = await verifyAccountPin(db, auth.accountId, parsed.data, audit);
  return c.json(envelope(result));
});
