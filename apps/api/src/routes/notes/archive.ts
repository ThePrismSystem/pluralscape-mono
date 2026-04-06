import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { archiveNote } from "../../services/note.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));
archiveRoute.use("*", requireScopeMiddleware("write:notes"));

archiveRoute.post("/:noteId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const noteId = requireIdParam(c.req.param("noteId"), "noteId", ID_PREFIXES.note);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveNote(db, systemId, noteId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
