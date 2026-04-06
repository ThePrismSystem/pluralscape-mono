import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { deletePollVote } from "../../services/poll-vote.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteVoteRoute = new Hono<AuthEnv>();

deleteVoteRoute.use("*", createCategoryRateLimiter("write"));
deleteVoteRoute.use("*", requireScopeMiddleware("write:polls"));

deleteVoteRoute.delete("/:pollId/votes/:voteId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const pollId = requireIdParam(c.req.param("pollId"), "pollId", ID_PREFIXES.poll);
  const voteId = parseIdParam(c.req.param("voteId"), ID_PREFIXES.pollVote);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deletePollVote(db, systemId, pollId, voteId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});
