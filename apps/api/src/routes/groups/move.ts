import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { moveGroup } from "../../services/group.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const moveRoute = new Hono<AuthEnv>();

moveRoute.use("*", createCategoryRateLimiter("write"));

moveRoute.post("/:groupId/move", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const groupId = parseIdParam(c.req.param("groupId"), ID_PREFIXES.group);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await moveGroup(db, systemId, groupId, body, auth, audit);
  return c.json(result);
});
