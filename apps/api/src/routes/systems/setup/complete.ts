import { ID_PREFIXES } from "@pluralscape/types";
import { SetupCompleteBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { setupComplete } from "../../../services/setup.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const setupCompleteRoute = new Hono<AuthEnv>();

setupCompleteRoute.use("*", createCategoryRateLimiter("write"));

setupCompleteRoute.post("/", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = SetupCompleteBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await setupComplete(db, systemId, parsed.data, auth, audit);
  return c.json(envelope(result));
});
