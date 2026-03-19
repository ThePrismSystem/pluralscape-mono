import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { wrapResult } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { reorderMemberPhotos } from "../../../services/member-photo.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const reorderRoute = new Hono<AuthEnv>();

reorderRoute.use("*", createCategoryRateLimiter("write"));

reorderRoute.put("/reorder", async (c) => {
  const body = await parseJsonBody(c);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const memberId = requireIdParam(c.req.param("memberId"), "memberId", ID_PREFIXES.member);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await reorderMemberPhotos(db, systemId, memberId, body, auth, audit);
  return c.json(wrapResult({ items: result }));
});
