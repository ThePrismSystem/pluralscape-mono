import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listFieldBucketVisibility } from "../../../services/field-bucket-visibility.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listVisibilityRoute = new Hono<AuthEnv>();

listVisibilityRoute.use("*", createCategoryRateLimiter("readDefault"));

listVisibilityRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const fieldDefinitionId = requireIdParam(
    c.req.param("fieldDefinitionId"),
    "fieldDefinitionId",
    ID_PREFIXES.fieldDefinition,
  );

  const db = await getDb();
  const result = await listFieldBucketVisibility(db, systemId, fieldDefinitionId, auth);
  return c.json(envelope(result));
});
