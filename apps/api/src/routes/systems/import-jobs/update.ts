import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_OK } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateImportJob } from "../../../services/system/import-jobs/update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.patch("/:importJobId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const importJobId = requireIdParam(
    c.req.param("importJobId"),
    "importJobId",
    ID_PREFIXES.importJob,
  );
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await updateImportJob(db, systemId, importJobId, body, auth, audit);
  return c.json(envelope(result), HTTP_OK);
});
