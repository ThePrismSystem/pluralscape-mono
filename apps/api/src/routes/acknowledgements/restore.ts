import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { restoreAcknowledgement } from "../../services/acknowledgement.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const restoreRoute = new Hono<AuthEnv>();

restoreRoute.use("*", createCategoryRateLimiter("write"));

restoreRoute.post("/:acknowledgementId/restore", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const acknowledgementId = requireIdParam(
    c.req.param("acknowledgementId"),
    "acknowledgementId",
    ID_PREFIXES.acknowledgement,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await restoreAcknowledgement(db, systemId, acknowledgementId, auth, audit);
  return c.json(result);
});
