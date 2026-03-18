import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { getQuotaService, getStorageAdapter } from "../../lib/storage.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { createUploadUrl } from "../../services/blob.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const uploadUrlRoute = new Hono<AuthEnv>();

uploadUrlRoute.use("*", createCategoryRateLimiter("blobUpload"));

uploadUrlRoute.post("/upload-url", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const storageAdapter = getStorageAdapter();
  const quotaService = getQuotaService(db);
  const result = await createUploadUrl(
    db,
    storageAdapter,
    quotaService,
    systemId,
    body,
    auth,
    audit,
  );
  return c.json(result, HTTP_CREATED);
});
