import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { deleteEntityType } from "../../../services/structure-entity.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:entityTypeId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const entityTypeId = requireIdParam(
    c.req.param("entityTypeId"),
    "entityTypeId",
    ID_PREFIXES.structureEntityType,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteEntityType(db, systemId, entityTypeId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
