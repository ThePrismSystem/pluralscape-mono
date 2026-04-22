import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateDeviceTokenBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateDeviceToken } from "../../services/device-token/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:tokenId", async (c) => {
  const auth = c.get("auth");
  const audit = createAuditWriter(c, auth);
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const tokenId = requireIdParam(c.req.param("tokenId"), "tokenId", ID_PREFIXES.deviceToken);
  const body = await parseJsonBody(c);

  const parsed = UpdateDeviceTokenBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const result = await updateDeviceToken(db, systemId, tokenId, parsed.data, auth, audit);
  return c.json(envelope(result));
});
