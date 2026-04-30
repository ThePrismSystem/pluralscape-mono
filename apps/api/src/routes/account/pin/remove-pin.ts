import { RemovePinBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { removeAccountPin } from "../../../services/account-pin.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const removePinRoute = new Hono<AuthEnv>();

removePinRoute.use("*", createCategoryRateLimiter("authHeavy"));

removePinRoute.delete("/", async (c) => {
  const body = await parseBody(c, RemovePinBodySchema);
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removeAccountPin(db, auth.accountId, body, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
