import { ID_PREFIXES } from "@pluralscape/types";
import { BucketExportQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_NOT_MODIFIED } from "../../http.constants.js";
import { getDb } from "../../lib/db.js";
import { checkConditionalRequest } from "../../lib/etag.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  getBucketExportManifest,
  getBucketExportPage,
} from "../../services/bucket-export.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const exportRoutes = new Hono<AuthEnv>();

exportRoutes.use("/manifest", createCategoryRateLimiter("readHeavy"));
exportRoutes.use("/", createCategoryRateLimiter("readHeavy"));

// ── Manifest ───────────────────────────────────────────────────────

exportRoutes.get("/manifest", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);

  const db = await getDb();
  const result = await getBucketExportManifest(db, systemId, bucketId, auth);

  c.header("ETag", result.etag);

  if (checkConditionalRequest(c.req.header("If-None-Match"), result.etag)) {
    return c.body(null, HTTP_NOT_MODIFIED);
  }

  return c.json(envelope(result));
});

// ── Paginated export ───────────────────────────────────────────────

exportRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);

  const parsed = BucketExportQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid query" },
      HTTP_BAD_REQUEST,
    );
  }

  const { entityType, limit, cursor } = parsed.data;
  const db = await getDb();
  const result = await getBucketExportPage(db, systemId, bucketId, auth, entityType, limit, cursor);

  c.header("ETag", result.etag);

  if (checkConditionalRequest(c.req.header("If-None-Match"), result.etag)) {
    return c.body(null, HTTP_NOT_MODIFIED);
  }

  return c.json(envelope(result));
});
