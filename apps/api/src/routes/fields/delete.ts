import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { deleteFieldDefinition } from "../../services/field-definition.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:fieldId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const fieldId = parseIdParam(c.req.param("fieldId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);
  const force = c.req.query("force") === "true";

  const db = await getDb();
  await deleteFieldDefinition(db, systemId, fieldId, auth, audit, { force });
  return c.body(null, HTTP_NO_CONTENT);
});
