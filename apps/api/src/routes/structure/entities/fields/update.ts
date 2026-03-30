import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../../lib/audit-writer.js";
import { getDb } from "../../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../../lib/id-param.js";
import { parseJsonBody } from "../../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../../middleware/rate-limit.js";
import { updateFieldValueForOwner } from "../../../../services/field-value.service.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:fieldDefId", async (c) => {
  const body = await parseJsonBody(c);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const entityId = requireIdParam(c.req.param("entityId"), "entityId", ID_PREFIXES.structureEntity);
  const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateFieldValueForOwner(
    db,
    systemId,
    { kind: "structureEntity", id: entityId },
    fieldDefId,
    body,
    auth,
    audit,
  );
  return c.json(result);
});
