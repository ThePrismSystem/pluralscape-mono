import { ID_PREFIXES } from "@pluralscape/types";
import { CopyGroupBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { copyGroup } from "../../services/group/structure.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const copyRoute = new Hono<AuthEnv>();

copyRoute.use("*", createCategoryRateLimiter("write"));
copyRoute.use("*", createIdempotencyMiddleware());

copyRoute.post("/:groupId/copy", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = CopyGroupBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") ?? "", ID_PREFIXES.system);
  const groupId = parseIdParam(c.req.param("groupId"), ID_PREFIXES.group);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await copyGroup(db, systemId, groupId, parsed.data, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
