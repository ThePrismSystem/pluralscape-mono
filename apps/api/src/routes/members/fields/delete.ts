import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { deleteFieldValue } from "../../../services/field-value.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:fieldDefId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const memberId = parseIdParam(c.req.param("memberId") as string, ID_PREFIXES.member);
  const fieldDefId = parseIdParam(c.req.param("fieldDefId"), ID_PREFIXES.fieldDefinition);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteFieldValue(db, systemId, memberId, fieldDefId, auth, audit);
  return c.json({ ok: true });
});
