import { Hono } from "hono";

import { authMiddleware } from "../../middleware/auth.js";

import { createRoute } from "./create.js";
import { deleteRoute } from "./delete.js";
import { getRoute } from "./get.js";
import { updateRoute } from "./update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const systemRoutes = new Hono<AuthEnv>();

// All system routes require authentication
systemRoutes.use("*", authMiddleware());

systemRoutes.route("/", getRoute);
systemRoutes.route("/", updateRoute);
systemRoutes.route("/", deleteRoute);
systemRoutes.route("/", createRoute);
