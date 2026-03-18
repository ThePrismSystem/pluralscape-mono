import { Hono } from "hono";

import { HTTP_UNAUTHORIZED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { getContextLogger } from "../../lib/logger.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { loginAccount } from "../../services/auth.service.js";

import { AUTH_GENERIC_LOGIN_ERROR } from "./auth.constants.js";

export const loginRoute = new Hono();

loginRoute.use("*", createCategoryRateLimiter("authHeavy"));

loginRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);

  const platform = extractPlatform(c);
  const audit = createAuditWriter(c);
  const log = getContextLogger(c);

  const db = await getDb();

  const result = await loginAccount(db, body, platform, audit, log);
  if (!result) {
    throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", AUTH_GENERIC_LOGIN_ERROR);
  }

  return c.json({
    sessionToken: result.sessionToken,
    accountId: result.accountId,
    systemId: result.systemId,
    accountType: result.accountType,
  });
});
