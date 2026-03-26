import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getAcknowledgement } from "../../services/acknowledgement.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.use("*", createCategoryRateLimiter("readDefault"));

getRoute.get("/:acknowledgementId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const acknowledgementId = requireIdParam(
    c.req.param("acknowledgementId"),
    "acknowledgementId",
    ID_PREFIXES.acknowledgement,
  );

  const db = await getDb();
  const result = await getAcknowledgement(db, systemId, acknowledgementId, auth);
  return c.json(result);
});
