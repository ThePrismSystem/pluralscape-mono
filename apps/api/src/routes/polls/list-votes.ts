import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";
import { listVotes, parsePollVoteQuery } from "../../services/poll-vote.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listVotesRoute = new Hono<AuthEnv>();

listVotesRoute.use("*", createCategoryRateLimiter("readDefault"));
listVotesRoute.use("*", requireScopeMiddleware("read:polls"));

listVotesRoute.get("/:pollId/votes", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const pollId = requireIdParam(c.req.param("pollId"), "pollId", ID_PREFIXES.poll);
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const query = parsePollVoteQuery({
    includeArchived: c.req.query("includeArchived"),
  });

  const db = await getDb();
  const result = await listVotes(db, systemId, pollId, auth, {
    cursor: c.req.query("cursor"),
    limit,
    includeArchived: query.includeArchived,
  });
  return c.json(result);
});
