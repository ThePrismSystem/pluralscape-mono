import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { archiveBlob } from "../../services/blob.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:blobId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const blobId = parseIdParam(c.req.param("blobId"), ID_PREFIXES.blob);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveBlob(db, systemId, blobId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
