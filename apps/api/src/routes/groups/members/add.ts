import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { addMember } from "../../../services/group-membership.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const addRoute = new Hono<AuthEnv>();

addRoute.use("*", createCategoryRateLimiter("write"));

addRoute.post("/", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const groupId = requireIdParam(c.req.param("groupId"), "groupId", ID_PREFIXES.group);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await addMember(db, systemId, groupId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});
