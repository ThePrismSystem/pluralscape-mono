import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { closePoll } from "../../services/poll.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const closeRoute = new Hono<AuthEnv>();

closeRoute.use("*", createCategoryRateLimiter("write"));
closeRoute.use("*", requireScopeMiddleware("write:polls"));

closeRoute.post("/:pollId/close", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const pollId = requireIdParam(c.req.param("pollId"), "pollId", ID_PREFIXES.poll);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await closePoll(db, systemId, pollId, auth, audit);
  return c.json(envelope(result));
});
