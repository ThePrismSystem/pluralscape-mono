import { Hono } from "hono";

import { archiveRoute } from "./archive.js";
import { castVoteRoute } from "./cast-vote.js";
import { closeRoute } from "./close.js";
import { createRoute } from "./create.js";
import { deleteVoteRoute } from "./delete-vote.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { listVotesRoute } from "./list-votes.js";
import { listRoute } from "./list.js";
import { restoreRoute } from "./restore.js";
import { resultsRoute } from "./results.js";
import { updateVoteRoute } from "./update-vote.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const pollRoutes = new Hono<AuthEnv>();

// Static paths first to avoid /:pollId capture
pollRoutes.route("/", listRoute);
pollRoutes.route("/", createRoute);
pollRoutes.route("/", closeRoute);
pollRoutes.route("/", archiveRoute);
pollRoutes.route("/", restoreRoute);
pollRoutes.route("/", castVoteRoute);
pollRoutes.route("/", listVotesRoute);
pollRoutes.route("/", resultsRoute);
pollRoutes.route("/", updateVoteRoute);
pollRoutes.route("/", deleteVoteRoute);
pollRoutes.route("/", getRoute);
pollRoutes.route("/", updateRoute);
pollRoutes.route("/", deleteRoute);
