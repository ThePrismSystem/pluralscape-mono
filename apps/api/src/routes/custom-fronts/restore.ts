import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { restoreCustomFront } from "../../services/custom-front.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));

restoreRoute.post("/:customFrontId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const customFrontId = parseIdParam(c.req.param("customFrontId"), ID_PREFIXES.customFront);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreCustomFront(db, systemId, customFrontId, auth, audit);
  return c.json(result);
});
