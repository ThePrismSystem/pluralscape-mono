import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateFieldDefinitionBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateFieldDefinition } from "../../services/field-definition/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:fieldId", async (c) => {
  const body = await parseBody(c, UpdateFieldDefinitionBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const fieldId = parseIdParam(c.req.param("fieldId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateFieldDefinition(db, systemId, fieldId, body, auth, audit);
  return c.json(envelope(result));
});
