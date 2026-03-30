import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../../../http.constants.js";
import { createAuditWriter } from "../../../../lib/audit-writer.js";
import { getDb } from "../../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../../lib/id-param.js";
import { parseJsonBody } from "../../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../../middleware/rate-limit.js";
import { setFieldValueForOwner } from "../../../../services/field-value.service.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const setRoute = new Hono<AuthEnv>();

setRoute.use("*", createCategoryRateLimiter("write"));

setRoute.post("/:fieldDefId", async (c) => {
  const body = await parseJsonBody(c);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const entityId = requireIdParam(c.req.param("entityId"), "entityId", ID_PREFIXES.structureEntity);
  const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await setFieldValueForOwner(
    db,
    systemId,
    { kind: "structureEntity", id: entityId },
    fieldDefId,
    body,
    auth,
    audit,
  );
  return c.json(result, HTTP_CREATED);
});
