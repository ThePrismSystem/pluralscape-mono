import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { getStorageAdapter } from "../../lib/storage.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getDownloadUrl } from "../../services/blob.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const downloadUrlRoute = new Hono<AuthEnv>();

downloadUrlRoute.use("*", createCategoryRateLimiter("readDefault"));
downloadUrlRoute.get("/:blobId/download-url", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const blobId = parseIdParam(c.req.param("blobId"), ID_PREFIXES.blob);

  const db = await getDb();
  const storageAdapter = getStorageAdapter();
  const result = await getDownloadUrl(db, storageAdapter, systemId, blobId, auth);
  return c.json(result);
});
