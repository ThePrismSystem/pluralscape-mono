import { ID_PREFIXES } from "@pluralscape/types";
import { PurgeSystemBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_NO_CONTENT } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { purgeSystem } from "../../services/system-purge.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const purgeRoute = new Hono<AuthEnv>();

purgeRoute.use("*", createCategoryRateLimiter("write"));

purgeRoute.post("/:id/purge", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id"), ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const rawBody = await parseJsonBody(c);
  const parsed = PurgeSystemBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  await purgeSystem(db, systemId, parsed.data, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
