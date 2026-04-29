import { ID_PREFIXES } from "@pluralscape/types";
import { CreateUploadUrlBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { getQuotaService, getStorageAdapter } from "../../lib/storage.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { createUploadUrl } from "../../services/blob/create-upload-url.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const uploadUrlRoute = new Hono<AuthEnv>();

uploadUrlRoute.use("*", createCategoryRateLimiter("blobUpload"));
uploadUrlRoute.use("*", createIdempotencyMiddleware());

uploadUrlRoute.post("/upload-url", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const rawBody = await parseJsonBody(c);
  const parsed = CreateUploadUrlBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const db = await getDb();
  const storageAdapter = getStorageAdapter();
  const quotaService = getQuotaService(db);
  const result = await createUploadUrl(
    db,
    storageAdapter,
    quotaService,
    systemId,
    parsed.data,
    auth,
    audit,
  );
  return c.json(envelope(result), HTTP_CREATED);
});
