import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { archiveCustomFront } from "../../services/custom-front/lifecycle.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:customFrontId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const customFrontId = parseIdParam(c.req.param("customFrontId"), ID_PREFIXES.customFront);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveCustomFront(db, systemId, customFrontId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
