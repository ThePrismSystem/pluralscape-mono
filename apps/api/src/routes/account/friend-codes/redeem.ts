import { RedeemFriendCodeBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createIdempotencyMiddleware } from "../../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { redeemFriendCode } from "../../../services/account/friend-codes/redeem.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const redeemRoute = new Hono<AuthEnv>();

redeemRoute.use("*", createCategoryRateLimiter("friendCodeRedeem"));
redeemRoute.use("*", createIdempotencyMiddleware());

redeemRoute.post("/redeem", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const parsed = RedeemFriendCodeBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const result = await redeemFriendCode(db, parsed.data.code, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
