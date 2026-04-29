import { UpdateAccountSettingsSchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { ConcurrencyError } from "../../services/account/internal.js";
import { updateAccountSettings } from "../../services/account/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateSettingsRoute = new Hono<AuthEnv>();
updateSettingsRoute.use("*", createCategoryRateLimiter("write"));

updateSettingsRoute.put("/", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const rawBody = await parseJsonBody(c);
  const parsed = UpdateAccountSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }
  const audit = createAuditWriter(c, auth);

  try {
    const result = await updateAccountSettings(db, auth.accountId, parsed.data, audit);
    return c.json(envelope(result));
  } catch (error: unknown) {
    if (error instanceof ConcurrencyError) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", error.message);
    }
    throw error;
  }
});
