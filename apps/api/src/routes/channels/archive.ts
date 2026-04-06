import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { archiveChannel } from "../../services/channel.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const archiveRoute = new Hono<AuthEnv>();

archiveRoute.use("*", createCategoryRateLimiter("write"));
archiveRoute.use("*", requireScopeMiddleware("write:channels"));

archiveRoute.post("/:channelId/archive", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const channelId = requireIdParam(c.req.param("channelId"), "channelId", ID_PREFIXES.channel);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await archiveChannel(db, systemId, channelId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
