import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateNomenclatureSettings } from "../../../services/nomenclature.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateNomenclatureRoute = new Hono<AuthEnv>();

updateNomenclatureRoute.use("*", createCategoryRateLimiter("write"));

updateNomenclatureRoute.put("/", async (c) => {
  const body = await parseJsonBody(c);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateNomenclatureSettings(db, systemId, body, auth, audit);
  return c.json(result);
});
