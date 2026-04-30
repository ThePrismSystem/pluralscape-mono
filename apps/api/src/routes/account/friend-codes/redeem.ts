import { RedeemFriendCodeBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
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
  const body = await parseBody(c, RedeemFriendCodeBodySchema);

  const db = await getDb();
  const result = await redeemFriendCode(db, body.code, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
