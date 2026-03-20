import { Hono } from "hono";

import { HTTP_TOO_MANY_REQUESTS, HTTP_UNAUTHORIZED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { getContextLogger } from "../../lib/logger.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { MS_PER_SECOND } from "../../middleware/middleware.constants.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { LoginThrottledError, loginAccount } from "../../services/auth.service.js";

import { AUTH_GENERIC_LOGIN_ERROR } from "./auth.constants.js";

import type { ApiErrorResponse } from "@pluralscape/types";

export const loginRoute = new Hono();

loginRoute.use("*", createCategoryRateLimiter("authHeavy"));

loginRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);

  const platform = extractPlatform(c);
  const audit = createAuditWriter(c);
  const log = getContextLogger(c);

  const db = await getDb();

  let result;
  try {
    result = await loginAccount(db, body, platform, audit, log);
  } catch (err: unknown) {
    if (err instanceof LoginThrottledError) {
      const retryAfter = Math.ceil((err.windowResetAt - Date.now()) / MS_PER_SECOND);
      c.header("Retry-After", String(Math.max(1, retryAfter)));
      const requestId = c.res.headers.get("X-Request-Id") ?? crypto.randomUUID();
      return c.json(
        {
          error: { code: "LOGIN_THROTTLED", message: "Too many failed login attempts" },
          requestId,
        } satisfies ApiErrorResponse,
        HTTP_TOO_MANY_REQUESTS,
      );
    }
    throw err;
  }

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
