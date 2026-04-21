import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { getQueue } from "../../lib/queue.js";
import { extractIpAddress } from "../../lib/request-meta.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  ConcurrencyError,
  changeEmail,
  enqueueAccountEmailChangedNotification,
} from "../../services/account.service.js";
import { ValidationError } from "../../services/auth/register.js";

import { EMAIL_CHANGE_FAILED_ERROR } from "./account.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const changeEmailRoute = new Hono<AuthEnv>();
changeEmailRoute.use("*", createCategoryRateLimiter("authHeavy"));

changeEmailRoute.put("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const body = await parseJsonBody(c);
  const audit = createAuditWriter(c, auth);
  const ipAddress = extractIpAddress(c);

  try {
    const result = await changeEmail(db, auth.accountId, body, audit);

    if (result.kind === "changed") {
      // Fire-and-forget: notify the OLD address of the change. The helper
      // owns queue-null/oldEmail-null short-circuiting, failure logging, and
      // audit-event persistence — we must NOT await or rethrow from it.
      void enqueueAccountEmailChangedNotification(getQueue(), audit, db, {
        accountId: auth.accountId,
        oldEmail: result.oldEmail,
        newEmail: result.newEmail,
        version: result.version,
        ipAddress,
      });
    }

    // Response body carries { ok: true } only — the prior/new plaintext
    // addresses are intentionally private (the client knows the new one and
    // the old one should not leak back through the API).
    return c.json(envelope({ ok: true as const }));
  } catch (error: unknown) {
    if (error instanceof ConcurrencyError) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", error.message);
    }
    if (error instanceof ValidationError) {
      const status = error.message === EMAIL_CHANGE_FAILED_ERROR ? HTTP_CONFLICT : HTTP_BAD_REQUEST;
      const code = error.message === EMAIL_CHANGE_FAILED_ERROR ? "CONFLICT" : "VALIDATION_ERROR";
      throw new ApiHttpError(status, code, error.message);
    }
    throw error;
  }
});
