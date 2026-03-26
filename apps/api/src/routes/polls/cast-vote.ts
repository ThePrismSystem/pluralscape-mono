import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { castVote } from "../../services/poll-vote.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const castVoteRoute = new Hono<AuthEnv>();

castVoteRoute.use("*", createCategoryRateLimiter("write"));

castVoteRoute.post("/:pollId/votes", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const pollId = requireIdParam(c.req.param("pollId"), "pollId", ID_PREFIXES.poll);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await castVote(db, systemId, pollId, body, auth, audit);
  return c.json(result, HTTP_CREATED);
});
