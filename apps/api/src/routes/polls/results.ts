import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { getPollResults } from "../../services/poll-vote.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const resultsRoute = new Hono<AuthEnv>();

resultsRoute.use("*", createCategoryRateLimiter("readDefault"));

resultsRoute.get("/:pollId/results", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const pollId = requireIdParam(c.req.param("pollId"), "pollId", ID_PREFIXES.poll);

  const db = await getDb();
  const result = await getPollResults(db, systemId, pollId, auth);
  return c.json(envelope(result));
});
