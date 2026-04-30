import { ID_PREFIXES } from "@pluralscape/types";
import { ConfirmAcknowledgementBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { confirmAcknowledgement } from "../../services/acknowledgement/confirm.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const confirmRoute = new Hono<AuthEnv>();

confirmRoute.use("*", createCategoryRateLimiter("write"));

confirmRoute.post("/:acknowledgementId/confirm", async (c) => {
  const body = await parseBody(c, ConfirmAcknowledgementBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const ackId = requireIdParam(
    c.req.param("acknowledgementId"),
    "acknowledgementId",
    ID_PREFIXES.acknowledgement,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await confirmAcknowledgement(db, systemId, ackId, body, auth, audit);
  return c.json(envelope(result));
});
