import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { deleteCustomFront } from "../../services/custom-front.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:customFrontId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const customFrontId = parseIdParam(c.req.param("customFrontId"), ID_PREFIXES.customFront);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteCustomFront(db, systemId, customFrontId, auth, audit);
  return c.json({ ok: true });
});
