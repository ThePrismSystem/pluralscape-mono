import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { confirmUpload } from "../../services/blob.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const confirmRoute = new Hono<AuthEnv>();

confirmRoute.use("*", createCategoryRateLimiter("write"));

confirmRoute.post("/:blobId/confirm", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const blobId = parseIdParam(c.req.param("blobId"), ID_PREFIXES.blob);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await confirmUpload(db, systemId, blobId, body, auth, audit);
  return c.json(result);
});
