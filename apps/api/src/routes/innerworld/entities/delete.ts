import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { deleteEntity } from "../../../services/innerworld-entity.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:entityId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const entityId = parseIdParam(c.req.param("entityId"), ID_PREFIXES.innerWorldEntity);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteEntity(db, systemId, entityId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
