import { Hono } from "hono";

import { HTTP_TOO_MANY_REQUESTS, HTTP_UNAUTHORIZED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { getContextLogger } from "../../lib/logger.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { extractPlatform } from "../../lib/request-meta.js";
import { envelope } from "../../lib/response.js";
import { MS_PER_SECOND } from "../../middleware/middleware.constants.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ACCOUNT_LOGIN_WINDOW_MS } from "../../middleware/stores/account-login-store.js";
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
      c.header("Retry-After", String(ACCOUNT_LOGIN_WINDOW_MS / MS_PER_SECOND));
      c.header("Cache-Control", "no-store");
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

  c.header("Cache-Control", "no-store");
  return c.json(
    envelope({
      sessionToken: result.sessionToken,
      accountId: result.accountId,
      systemId: result.systemId,
      accountType: result.accountType,
    }),
  );
});
