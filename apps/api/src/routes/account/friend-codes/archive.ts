import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { archiveFriendCode } from "../../../services/account/friend-codes/archive.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));

archiveRoute.post("/:codeId/archive", async (c) => {
  const auth = c.get("auth");
  const codeId = requireIdParam(c.req.param("codeId"), "codeId", ID_PREFIXES.friendCode);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveFriendCode(db, auth.accountId, codeId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
