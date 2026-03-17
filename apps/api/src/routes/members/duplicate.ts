import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { duplicateMember } from "../../services/member.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const duplicateRoute = new Hono<AuthEnv>();

duplicateRoute.use("*", createCategoryRateLimiter("write"));

duplicateRoute.post("/:memberId/duplicate", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const memberId = parseIdParam(c.req.param("memberId"), ID_PREFIXES.member);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await duplicateMember(db, systemId, memberId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});
