import { ID_PREFIXES } from "@pluralscape/types";
import { UntagContentParamsSchema } from "@pluralscape/validation";
import { Hono } from "hono";
import { z } from "zod/v4";

import { HTTP_BAD_REQUEST, HTTP_NO_CONTENT } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { untagContent } from "../../../services/bucket-content-tag.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const untagRoute = new Hono<AuthEnv>();

untagRoute.use("*", createCategoryRateLimiter("write"));

untagRoute.delete("/:entityType/:entityId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const audit = createAuditWriter(c, auth);

  const parsed = UntagContentParamsSchema.safeParse({
    entityType: c.req.param("entityType"),
    entityId: c.req.param("entityId"),
  });
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid (entityType, entityId) pair",
      z.treeifyError(parsed.error),
    );
  }

  const db = await getDb();
  await untagContent(db, systemId, bucketId, parsed.data, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
