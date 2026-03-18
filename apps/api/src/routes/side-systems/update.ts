import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateSideSystem } from "../../services/side-system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:sideSystemId", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const sideSystemId = parseIdParam(c.req.param("sideSystemId"), ID_PREFIXES.sideSystem);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateSideSystem(db, systemId, sideSystemId, body, auth, audit);
  return c.json(result);
});
