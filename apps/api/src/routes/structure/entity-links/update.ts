import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateStructureEntityLinkBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateEntityLink } from "../../../services/structure/link.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:linkId", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = UpdateStructureEntityLinkBodySchema.safeParse(rawBody);
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
  const linkId = requireIdParam(c.req.param("linkId"), "linkId", ID_PREFIXES.structureEntityLink);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateEntityLink(db, systemId, linkId, parsed.data, auth, audit);
  return c.json(envelope(result));
});
