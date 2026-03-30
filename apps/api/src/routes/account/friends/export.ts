import { ID_PREFIXES } from "@pluralscape/types";
import { FriendExportQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_NOT_MODIFIED } from "../../../http.constants.js";
import { getDb } from "../../../lib/db.js";
import { checkConditionalRequest } from "../../../lib/etag.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import {
  getFriendExportManifest,
  getFriendExportPage,
} from "../../../services/friend-export.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const exportRoutes = new Hono<AuthEnv>();

exportRoutes.use("*", createCategoryRateLimiter("readDefault"));

// ── Manifest ───────────────────────────────────────────────────────

exportRoutes.get("/:connectionId/export/manifest", async (c) => {
  const auth = c.get("auth");
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );

  const db = await getDb();
  const result = await getFriendExportManifest(db, connectionId, auth);

  c.header("ETag", result.etag);

  if (checkConditionalRequest(c.req.header("If-None-Match"), result.etag)) {
    return c.body(null, HTTP_NOT_MODIFIED);
  }

  return c.json(envelope(result));
});

// ── Paginated export ───────────────────────────────────────────────

exportRoutes.get("/:connectionId/export", async (c) => {
  const auth = c.get("auth");
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );

  const parsed = FriendExportQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid query" },
      HTTP_BAD_REQUEST,
    );
  }

  const { entityType, limit, cursor } = parsed.data;
  const db = await getDb();
  const result = await getFriendExportPage(db, connectionId, auth, entityType, limit, cursor);

  c.header("ETag", result.etag);

  if (checkConditionalRequest(c.req.header("If-None-Match"), result.etag)) {
    return c.body(null, HTTP_NOT_MODIFIED);
  }

  return c.json(result);
});
