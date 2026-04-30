import { ID_PREFIXES } from "@pluralscape/types";
import { MoveGroupBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { moveGroup } from "../../services/group/structure.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const moveRoute = new Hono<AuthEnv>();

moveRoute.use("*", createCategoryRateLimiter("write"));

moveRoute.post("/:groupId/move", async (c) => {
  const body = await parseBody(c, MoveGroupBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const groupId = parseIdParam(c.req.param("groupId"), ID_PREFIXES.group);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await moveGroup(db, systemId, groupId, body, auth, audit);
  return c.json(envelope(result));
});
