import { ID_PREFIXES } from "@pluralscape/types";
import { ImportEntityRefUpsertBatchBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_OK } from "../../../http.constants.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { upsertImportEntityRefBatch } from "../../../services/system/import-entity-refs/upsert-batch.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const upsertBatchRoute = new Hono<AuthEnv>();

upsertBatchRoute.use("*", createCategoryRateLimiter("write"));

/**
 * POST /systems/:systemId/import-entity-refs/upsert-batch
 *
 * Idempotent: re-running with the same payload updates `pluralscape_entity_id`
 * on conflict via the unique index on
 * (account_id, system_id, source, source_entity_type, source_entity_id).
 */
upsertBatchRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const body = await parseBody(c, ImportEntityRefUpsertBatchBodySchema);

  const db = await getDb();
  const result = await upsertImportEntityRefBatch(db, systemId, body, auth);
  return c.json(envelope(result), HTTP_OK);
});
