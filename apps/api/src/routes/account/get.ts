import { Hono } from "hono";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getAccountInfo } from "../../services/account.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();
getRoute.use("*", createCategoryRateLimiter("authLight"));

getRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();

  const info = await getAccountInfo(db, auth.accountId);
  if (!info) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Account not found");
  }

  c.header("Cache-Control", "no-store");
  return c.json(envelope(info));
});
