import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { archiveMemberPhoto } from "../../../services/member-photo.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:photoId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const memberId = parseIdParam(c.req.param("memberId") as string, ID_PREFIXES.member);
  const photoId = parseIdParam(c.req.param("photoId"), ID_PREFIXES.memberPhoto);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveMemberPhoto(db, systemId, memberId, photoId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
