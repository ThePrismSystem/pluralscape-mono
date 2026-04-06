import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { archiveAcknowledgement } from "../../services/acknowledgement.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));
archiveRoute.use("*", requireScopeMiddleware("write:acknowledgements"));

archiveRoute.post("/:acknowledgementId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const acknowledgementId = requireIdParam(
    c.req.param("acknowledgementId"),
    "acknowledgementId",
    ID_PREFIXES.acknowledgement,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveAcknowledgement(db, systemId, acknowledgementId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
