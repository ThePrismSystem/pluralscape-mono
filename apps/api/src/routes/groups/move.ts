import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { moveGroup } from "../../services/group.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const moveRoute = new Hono<AuthEnv>();

moveRoute.use("*", createCategoryRateLimiter("write"));

moveRoute.post("/:groupId/move", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const groupId = parseIdParam(c.req.param("groupId"), ID_PREFIXES.group);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await moveGroup(db, systemId, groupId, body, auth, audit);
  return c.json(result);
});
