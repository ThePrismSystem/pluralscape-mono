import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateStructureEntityTypeBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateEntityType } from "../../../services/structure/entity-type/update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:entityTypeId", async (c) => {
  const body = await parseBody(c, UpdateStructureEntityTypeBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const entityTypeId = parseIdParam(c.req.param("entityTypeId"), ID_PREFIXES.structureEntityType);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateEntityType(db, systemId, entityTypeId, body, auth, audit);
  return c.json(envelope(result));
});
