import { ID_PREFIXES } from "@pluralscape/types";
import { ConfirmUploadBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { confirmUpload } from "../../services/blob/confirm-upload.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const confirmRoute = new Hono<AuthEnv>();

confirmRoute.use("*", createCategoryRateLimiter("write"));

confirmRoute.post("/:blobId/confirm", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const blobId = parseIdParam(c.req.param("blobId"), ID_PREFIXES.blob);
  const audit = createAuditWriter(c, auth);
  const rawBody = await parseJsonBody(c);
  const parsed = ConfirmUploadBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const result = await confirmUpload(db, systemId, blobId, parsed.data, auth, audit);
  return c.json(envelope(result));
});
