import { ID_PREFIXES } from "@pluralscape/types";
import { DuplicateMemberBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { duplicateMember } from "../../services/member/create.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const duplicateRoute = new Hono<AuthEnv>();

duplicateRoute.use("*", createCategoryRateLimiter("write"));
duplicateRoute.use("*", createIdempotencyMiddleware());

duplicateRoute.post("/:memberId/duplicate", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = DuplicateMemberBodySchema.safeParse(rawBody);
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
  const memberId = parseIdParam(c.req.param("memberId"), ID_PREFIXES.member);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await duplicateMember(db, systemId, memberId, parsed.data, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});
