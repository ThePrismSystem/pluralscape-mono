import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../../lib/db.js";
import { requireIdParam } from "../../../../lib/id-param.js";
import { wrapResult } from "../../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../../middleware/rate-limit.js";
import { listFieldValuesForOwner } from "../../../../services/field-value.service.js";

import type { AuthEnv } from "../../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const entityId = requireIdParam(c.req.param("entityId"), "entityId", ID_PREFIXES.structureEntity);

  const db = await getDb();
  const result = await listFieldValuesForOwner(
    db,
    systemId,
    { kind: "structureEntity", id: entityId },
    auth,
  );
  return c.json(wrapResult({ items: result }));
});
