import { Hono } from "hono";

import { HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ConcurrencyError, updateAccountSettings } from "../../services/account.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateSettingsRoute = new Hono<AuthEnv>();
updateSettingsRoute.use("*", createCategoryRateLimiter("write"));

updateSettingsRoute.put("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const body = await parseJsonBody(c);
  const audit = createAuditWriter(c, auth);

  try {
    const result = await updateAccountSettings(db, auth.accountId, body, audit);
    return c.json(result);
  } catch (error: unknown) {
    if (error instanceof ConcurrencyError) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", error.message);
    }
    throw error;
  }
});
