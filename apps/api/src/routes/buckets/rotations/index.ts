import { Hono } from "hono";

import { claimRoute } from "./claim.js";
import { completeChunkRoute } from "./complete-chunk.js";
import { initiateRoute } from "./initiate.js";
import { progressRoute } from "./progress.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const rotationRoutes = new Hono<AuthEnv>();

rotationRoutes.route("/", initiateRoute);
rotationRoutes.route("/", progressRoute);
rotationRoutes.route("/", claimRoute);
rotationRoutes.route("/", completeChunkRoute);
