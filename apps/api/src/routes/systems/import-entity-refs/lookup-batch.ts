import { ID_PREFIXES } from "@pluralscape/types";
import { ImportEntityRefLookupBatchBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_OK } from "../../../http.constants.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { lookupImportEntityRefBatch } from "../../../services/system/import-entity-refs/lookup.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const lookupBatchRoute = new Hono<AuthEnv>();

lookupBatchRoute.use("*", createCategoryRateLimiter("readDefault"));

/**
 * POST /systems/:systemId/import-entity-refs/lookup-batch
 *
 * POST is used (not GET) because the payload is an array that may exceed
 * practical query-string limits during mobile imports.
 */
lookupBatchRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const body = await parseBody(c, ImportEntityRefLookupBatchBodySchema);

  const db = await getDb();
  const map = await lookupImportEntityRefBatch(db, systemId, body, auth);
  return c.json(envelope(Object.fromEntries(map)), HTTP_OK);
});
