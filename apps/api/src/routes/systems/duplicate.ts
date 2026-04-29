import { ID_PREFIXES } from "@pluralscape/types";
import { DuplicateSystemBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { duplicateSystem } from "../../services/system-duplicate.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const duplicateRoute = new Hono<AuthEnv>();

duplicateRoute.use("*", createCategoryRateLimiter("write"));
duplicateRoute.use("*", createIdempotencyMiddleware());

duplicateRoute.post("/:id/duplicate", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id"), ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const rawBody = await parseJsonBody(c);
  const parsed = DuplicateSystemBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const result = await duplicateSystem(db, systemId, parsed.data, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
