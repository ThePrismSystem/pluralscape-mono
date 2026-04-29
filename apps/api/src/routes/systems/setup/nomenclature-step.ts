import { ID_PREFIXES } from "@pluralscape/types";
import { SetupNomenclatureStepBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_NO_CONTENT } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { setupNomenclatureStep } from "../../../services/setup.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const nomenclatureStepRoute = new Hono<AuthEnv>();

nomenclatureStepRoute.use("*", createCategoryRateLimiter("write"));

nomenclatureStepRoute.post("/", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = SetupNomenclatureStepBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await setupNomenclatureStep(db, systemId, parsed.data, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
