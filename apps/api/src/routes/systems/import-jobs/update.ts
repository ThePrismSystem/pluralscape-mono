import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateImportJobBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_OK } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
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
  const rawBody = await parseJsonBody(c);
  const parsed = UpdateImportJobBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid request body", {
      issues: parsed.error.issues,
    });
  }

  const db = await getDb();
  const result = await updateImportJob(db, systemId, importJobId, parsed.data, auth, audit);
  return c.json(envelope(result), HTTP_OK);
});
