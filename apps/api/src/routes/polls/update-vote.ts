import { ID_PREFIXES } from "@pluralscape/types";
import { UpdatePollVoteBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updatePollVote } from "../../services/poll-vote/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateVoteRoute = new Hono<AuthEnv>();

updateVoteRoute.use("*", createCategoryRateLimiter("write"));

updateVoteRoute.put("/:pollId/votes/:voteId", async (c) => {
  const rawBody = await parseJsonBody(c);
  const parsed = UpdatePollVoteBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid request body",
      parsed.error.issues,
    );
  }

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const pollId = requireIdParam(c.req.param("pollId"), "pollId", ID_PREFIXES.poll);
  const voteId = parseIdParam(c.req.param("voteId"), ID_PREFIXES.pollVote);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updatePollVote(db, systemId, pollId, voteId, parsed.data, auth, audit);
  return c.json(envelope(result));
});
