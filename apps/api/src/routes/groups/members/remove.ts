import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { removeMember } from "../../../services/group-membership.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const removeRoute = new Hono<AuthEnv>();

removeRoute.use("*", createCategoryRateLimiter("write"));

removeRoute.delete("/:memberId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const groupId = requireIdParam(c.req.param("groupId"), "groupId", ID_PREFIXES.group);
  const memberId = parseIdParam(c.req.param("memberId"), ID_PREFIXES.member);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await removeMember(db, systemId, groupId, memberId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
