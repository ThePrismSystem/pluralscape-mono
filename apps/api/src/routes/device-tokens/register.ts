import { ID_PREFIXES } from "@pluralscape/types";
import { RegisterDeviceTokenBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { registerDeviceToken } from "../../services/device-token.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const registerRoute = new Hono<AuthEnv>();

registerRoute.use("*", createCategoryRateLimiter("write"));

registerRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const body = await parseJsonBody(c);

  const parsed = RegisterDeviceTokenBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const result = await registerDeviceToken(db, systemId, parsed.data, auth, audit);
  return c.json(result, HTTP_CREATED);
});
